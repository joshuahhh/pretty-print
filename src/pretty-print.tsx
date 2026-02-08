import * as prettier from "prettier";
import React from "react";
import { StringTagger } from "./string-tagger.js";

const { group, indent, line, softline, ifBreak } = prettier.doc.builders;

type Doc = prettier.Doc;

// Single source of truth for all color information
const COLORS = [
  { name: "string", ansi: "\x1b[32m", hex: "#22c55e" }, // green
  { name: "number", ansi: "\x1b[33m", hex: "#eab308" }, // yellow
  { name: "boolean", ansi: "\x1b[35m", hex: "#a855f7" }, // magenta
  { name: "null", ansi: "\x1b[90m", hex: "#6b7280" }, // gray
  { name: "key", ansi: "\x1b[36m", hex: "#06b6d4" }, // cyan
  { name: "keyword", ansi: "\x1b[34m", hex: "#3b82f6" }, // blue
  { name: "type", ansi: "\x1b[95m", hex: "#ec4899" }, // bright magenta
  { name: "id", ansi: "\x1b[90m", hex: "#9ca3af" }, // faded gray
] as const;

type ColorType = (typeof COLORS)[number]["name"];

const ANSI_RESET = "\x1b[0m";

const COLOR_NAME_TO_ANSI = Object.fromEntries(
  COLORS.map((c) => [c.name, c.ansi])
) as Record<ColorType, string>;

// Derived: ANSI code -> hex color lookup
const ANSI_TO_HEX = Object.fromEntries(
  COLORS.map((c) => [c.ansi.match(/\d+/)?.[0] || "", c.hex])
) as Record<string, string>;

/**
 * Converts ANSI color codes to browser console %c format with CSS styles.
 */
export function prettyPrintForBrowser(
  value: unknown,
  printWidth: number = 80
): [string, ...string[]] {
  const textWithAnsi = prettyPrintToString(value, printWidth, true);
  const ansiRegex = /\x1b\[(\d+)m/g;
  const parts: string[] = [];
  const styles: string[] = [];
  let lastIndex = 0;
  let currentStyle = "";
  let match;

  while ((match = ansiRegex.exec(textWithAnsi)) !== null) {
    const textBefore = textWithAnsi.slice(lastIndex, match.index);
    if (textBefore) {
      parts.push("%c" + textBefore);
      styles.push(currentStyle);
    }
    const hexColor = ANSI_TO_HEX[match[1]];
    currentStyle = hexColor ? `color: ${hexColor}` : "";
    lastIndex = match.index + match[0].length;
  }

  const remaining = textWithAnsi.slice(lastIndex);
  if (remaining) {
    parts.push("%c" + remaining);
    styles.push(currentStyle);
  }

  return [parts.join(""), ...styles];
}

/**
 * Pretty-print a value to the browser console with colors.
 * This is the easiest way to use the pretty-printer in browser code.
 */
export function prettyLog(
  value: unknown,
  { label, width = 120 }: { label?: string; width?: number } = {}
): void {
  if (label) {
    console.group(label);
  }
  console.log(...prettyPrintForBrowser(value, width));
  if (label) {
    console.groupEnd();
  }
}

/**
 * React component that pretty-prints a value and automatically adjusts
 * to the width of its container.
 */
export function PrettyPrint({
  value,
  style,
  className,
}: {
  value: unknown;
  style?: React.CSSProperties;
  className?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLSpanElement>(null);
  const [printWidth, setPrintWidth] = React.useState(80);

  React.useEffect(() => {
    if (!containerRef.current || !measureRef.current) return;

    const updateWidth = () => {
      if (!containerRef.current || !measureRef.current) return;

      // Measure actual character width by measuring a sample string
      const sampleWidth = measureRef.current.offsetWidth;
      const sampleLength = 100; // We measure a 100-character string
      const charWidth = sampleWidth / sampleLength;

      const containerWidth = containerRef.current.offsetWidth;
      const charsPerLine = Math.floor(containerWidth / charWidth);
      setPrintWidth(charsPerLine); // minimum 40 chars
    };

    // Initial measurement (with slight delay to ensure fonts are loaded)
    setTimeout(updateWidth, 0);

    // Watch for container size changes
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  // Convert ANSI color codes to React elements with inline styles
  const textWithAnsi = prettyPrintToString(value, printWidth, true);
  const ansiRegex = /\x1b\[(\d+)m/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let currentColor = "";
  let match;
  let key = 0;

  while ((match = ansiRegex.exec(textWithAnsi)) !== null) {
    const textBefore = textWithAnsi.slice(lastIndex, match.index);
    if (textBefore) {
      elements.push(
        <span key={key++} style={{ color: currentColor || "inherit" }}>
          {textBefore}
        </span>
      );
    }
    currentColor = ANSI_TO_HEX[match[1]] || "";
    lastIndex = match.index + match[0].length;
  }

  const remaining = textWithAnsi.slice(lastIndex);
  if (remaining) {
    elements.push(
      <span key={key++} style={{ color: currentColor || "inherit" }}>
        {remaining}
      </span>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", ...style, overflowX: "auto" }}
      className={className}
    >
      {/* Hidden measurement element with same font as output */}
      <span
        ref={measureRef}
        style={{
          position: "absolute",
          visibility: "hidden",
          fontFamily: "monospace",
          whiteSpace: "pre",
        }}
      >
        {/* 100 characters for measurement */}
        {"0123456789".repeat(10)}
      </span>
      <pre style={{ margin: 0, fontFamily: "monospace", maxWidth: "100%" }}>
        {elements}
      </pre>
    </div>
  );
}

/**
 * Pretty-print a JavaScript value using Prettier's doc builder API.
 * Returns a Doc that can be printed with prettier.printDocToString()
 */
function prettyPrintToDoc(
  value: unknown,
  tagger: StringTagger | null,
  visited: Set<unknown> = new Set()
): Doc {
  // Helper to colorize text if tagger is available
  const colorize = (text: string, colorType: ColorType): string => {
    if (!tagger) return text;
    const ansi = COLOR_NAME_TO_ANSI[colorType];
    return tagger.tag(text, ansi, ANSI_RESET);
  };
  // Handle JSX elements
  if (true) {
    // Change to false to disable JSX printing
    if (React.isValidElement(value)) {
      const element = value as React.ReactElement;
      const type =
        typeof element.type === "string"
          ? element.type
          : element.type.name || "Component";
      const props = element.props as Record<string, unknown> & {
        children?: React.ReactNode;
      };
      const { children, ...otherProps } = props;

      const openTag = colorize(`<${type}`, "keyword");
      const closeTag = colorize(`</${type}>`, "keyword");
      const selfCloseTag = colorize("/>", "keyword");

      // Format props
      const propEntries = Object.entries(otherProps);
      const propDocs: Doc[] = [];
      for (let i = 0; i < propEntries.length; i++) {
        const [key, val] = propEntries[i];
        const keyStr = colorize(key, "key");
        const valDoc =
          typeof val === "string"
            ? colorize(JSON.stringify(val), "string")
            : ["{", prettyPrintToDoc(val, tagger, visited), "}"];
        propDocs.push(ifBreak(line, " "), keyStr, "=", valDoc);
      }

      const childrenArray = React.Children.toArray(children);
      const hasChildren = childrenArray.length > 0;

      if (!hasChildren && propEntries.length === 0) {
        return [openTag, " ", selfCloseTag];
      }

      if (!hasChildren) {
        return group([
          openTag,
          indent(propDocs),
          ifBreak(line, " "),
          selfCloseTag,
        ]);
      }

      const childDocs = childrenArray.map((child) =>
        typeof child === "string" || typeof child === "number"
          ? String(child)
          : prettyPrintToDoc(child, tagger, visited)
      );

      // Add conditional line breaks between children
      // When inline, no separator. When broken, each child on its own line.
      const childDocsWithSeparators: Doc[] = [];
      for (let i = 0; i < childDocs.length; i++) {
        childDocsWithSeparators.push(childDocs[i]);
        if (i < childDocs.length - 1) {
          childDocsWithSeparators.push(ifBreak(line, ""));
        }
      }

      // Group the opening tag separately so it can stay on one line if it fits,
      // then group the whole element to allow compact inline formatting when possible
      const openingTag = group([
        openTag,
        indent(propDocs),
        colorize(">", "keyword"),
      ]);

      return group([
        openingTag,
        indent([softline, ...childDocsWithSeparators]),
        softline,
        closeTag,
      ]);
    }
  }

  // Handle primitives
  if (value === null) return colorize("null", "null");
  if (value === undefined) return colorize("undefined", "null");

  if (typeof value === "string") {
    return colorize(JSON.stringify(value), "string");
  }

  if (typeof value === "number") {
    return colorize(String(value), "number");
  }

  if (typeof value === "boolean") {
    return colorize(String(value), "boolean");
  }

  if (typeof value === "function") {
    return value.name ? `[Function: ${value.name}]` : "[Function]";
  }

  if (typeof value === "symbol") {
    return value.toString();
  }

  if (typeof value === "bigint") {
    return colorize(`${value}n`, "number");
  }

  // Check for circular references (objects and arrays)
  if (typeof value === "object" && value !== null) {
    if (visited.has(value)) {
      return colorize("[Circular]", "null");
    }
  }
  // Mark this object/array as visited
  visited = new Set(visited);
  visited.add(value);

  // Handle arrays
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }

    const elements = value.map((item) =>
      prettyPrintToDoc(item, tagger, visited)
    );

    // Use commas when inline, line breaks when multi-line
    const withSeparators: Doc[] = [];
    for (let i = 0; i < elements.length; i++) {
      withSeparators.push(elements[i]);
      if (i < elements.length - 1) {
        withSeparators.push(ifBreak(line, ", "));
      }
    }

    return group(["[", indent([softline, ...withSeparators]), softline, "]"]);
  }

  // Handle objects
  if (typeof value === "object") {
    // Handle special objects
    if (value instanceof Date) {
      const keyword = colorize("new", "keyword");
      const ctor = colorize("Date", "keyword");
      const str = tagger
        ? colorize(`"${value.toISOString()}"`, "string")
        : `"${value.toISOString()}"`;
      return [keyword, " ", ctor, "(", str, ")"];
    }

    if (value instanceof RegExp) {
      return colorize(value.toString(), "string");
    }

    if (value instanceof Map) {
      if (value.size === 0) {
        const keyword = colorize("new", "keyword");
        const ctor = colorize("Map", "keyword");
        return [keyword, " ", ctor, "()"];
      }
      const keyword = colorize("new", "keyword");
      const ctor = colorize("Map", "keyword");
      const entries = Array.from(value.entries()).map(([k, v]) => [
        "[",
        prettyPrintToDoc(k, tagger, visited),
        ", ",
        prettyPrintToDoc(v, tagger, visited),
        "]",
      ]);

      const withSeparators: Doc[] = [];
      for (let i = 0; i < entries.length; i++) {
        withSeparators.push(entries[i]);
        if (i < entries.length - 1) {
          withSeparators.push(ifBreak(line, ", "));
        }
      }

      return group([
        keyword,
        " ",
        ctor,
        "([",
        indent([softline, ...withSeparators]),
        softline,
        "])",
      ]);
    }

    if (value instanceof Set) {
      if (value.size === 0) {
        const keyword = colorize("new", "keyword");
        const ctor = colorize("Set", "keyword");
        return [keyword, " ", ctor, "()"];
      }
      const keyword = colorize("new", "keyword");
      const ctor = colorize("Set", "keyword");
      const items = Array.from(value).map((v) =>
        prettyPrintToDoc(v, tagger, visited)
      );

      const withSeparators: Doc[] = [];
      for (let i = 0; i < items.length; i++) {
        withSeparators.push(items[i]);
        if (i < items.length - 1) {
          withSeparators.push(ifBreak(line, ", "));
        }
      }

      return group([
        keyword,
        " ",
        ctor,
        "([",
        indent([softline, ...withSeparators]),
        softline,
        "])",
      ]);
    }

    // Handle plain objects
    const entries = Object.entries(value);

    if (entries.length === 0) {
      return "{}";
    }

    // Check if object has "type" and/or "id" fields
    const typeEntry = entries.find(([key]) => key === "type");
    const typeValue = typeEntry?.[1];
    const idEntry = entries.find(([key]) => key === "id");
    const idValue = idEntry?.[1];

    const remainingEntries = entries.filter(
      ([key]) => key !== "type" && key !== "id"
    );

    const props = remainingEntries.map(([key, val]) => {
      const keyStr = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
        ? key
        : JSON.stringify(key);
      const coloredKey = colorize(keyStr, "key");
      return [coloredKey, ": ", prettyPrintToDoc(val, tagger, visited)];
    });

    // Use commas when inline, line breaks when multi-line
    const withSeparators: Doc[] = [];
    for (let i = 0; i < props.length; i++) {
      withSeparators.push(props[i]);
      if (i < props.length - 1) {
        withSeparators.push(ifBreak(line, ", "));
      }
    }

    // Build the prefix: "type#id" or "type" or "#id"
    const prefix: Doc[] = [];
    if (typeValue && typeof typeValue === "string") {
      prefix.push(colorize(typeValue, "type"));
    }
    if (idValue !== undefined) {
      prefix.push(colorize("#" + String(idValue), "id"));
    }

    return group([
      "{",
      prefix.length > 0 ? prefix : "",
      prefix.length > 0 ? " " : "",
      remainingEntries.length > 0 ? indent([softline, ...withSeparators]) : "",
      remainingEntries.length > 0 ? softline : "",
      "}",
    ]);
  }

  return "[Unknown]";
}

/**
 * Pretty-print a JavaScript value to a string.
 * @param value The value to pretty-print
 * @param printWidth Maximum line width (default: 80)
 * @param useColor Whether to include colors (default: true)
 */
export function prettyPrintToString(
  value: unknown,
  printWidth: number = 80,
  useColor: boolean = true
): string {
  const tagger = useColor ? new StringTagger() : null;
  const doc = prettyPrintToDoc(value, tagger);
  const formatted = prettier.doc.printer.printDocToString(doc, {
    printWidth,
    tabWidth: 2,
    useTabs: false,
  }).formatted;

  return tagger ? tagger.expand(formatted) : formatted;
}

// Shared test data
export const testData = {
  primitives: { number: 42, string: "hello", bool: true, nil: null },
  arrays: [1, 2, 3],
  longArray: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  object: { a: 1, b: 2 },
  typePrefix: { type: "person", first: "Albert", last: "Einstein" },
  nested: {
    users: [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ],
  },
};
