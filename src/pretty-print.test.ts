import React from "react";
import { describe, expect, it } from "vitest";
import { prettyPrintToString } from "./pretty-print.js";

describe("prettyPrintToString", () => {
  it("should format with and without ANSI codes", () => {
    const longArray = Array.from({ length: 20 }, (_, i) => i);

    const withoutAnsi = prettyPrintToString(longArray, {
      width: 200,
      useColor: false,
    });
    const withAnsi = prettyPrintToString(longArray, {
      width: 200,
      useColor: true,
    });

    // Count ANSI escape sequences
    const ansiMatches = withAnsi.match(/\x1b\[\d+m/g);
    expect(ansiMatches).toBeTruthy();
    expect(withAnsi.length).toBeGreaterThan(withoutAnsi.length);
  });

  it("should format long arrays inline with wide printWidth", () => {
    const longArray = Array.from({ length: 20 }, (_, i) => i);
    const result = prettyPrintToString(longArray, {
      width: 200,
      useColor: false,
    });

    // With width 200, this should be all on one line
    expect(result).not.toContain("\n");
  });

  it("should format long arrays with line breaks when narrow", () => {
    const longArray = Array.from({ length: 20 }, (_, i) => i);
    const result = prettyPrintToString(longArray, {
      width: 40,
      useColor: false,
    });

    // With width 40, this should break across multiple lines
    expect(result).toContain("\n");
  });

  it("should format objects with wide printWidth", () => {
    const obj = {
      a: 1,
      b: 2,
      c: 3,
      d: 4,
      e: 5,
      f: 6,
      g: 7,
      h: 8,
    };
    const result = prettyPrintToString(obj, { width: 200, useColor: false });

    // Should be relatively compact
    expect(result.split("\n").length).toBeLessThan(10);
  });

  it("should format nested structures", () => {
    const nested = {
      users: [
        { id: 1, name: "Alice", age: 30 },
        { id: 2, name: "Bob", age: 25 },
        { id: 3, name: "Charlie", age: 35 },
      ],
    };

    const wide = prettyPrintToString(nested, { width: 200, useColor: false });
    const narrow = prettyPrintToString(nested, { width: 40, useColor: false });

    // Wide version should have fewer line breaks
    expect(wide.split("\n").length).toBeLessThan(narrow.split("\n").length);
  });

  it("should handle very long arrays", () => {
    const veryLongArray = Array.from({ length: 50 }, (_, i) => i + 1);

    const wide = prettyPrintToString(veryLongArray, {
      width: 300,
      useColor: false,
    });
    const narrow = prettyPrintToString(veryLongArray, {
      width: 60,
      useColor: false,
    });

    // Both should contain all elements
    expect(wide).toContain("49");
    expect(narrow).toContain("49");

    // Narrow should have more line breaks
    expect(narrow.split("\n").length).toBeGreaterThan(wide.split("\n").length);
  });

  it("should detect circular references in objects", () => {
    const obj: Record<string, unknown> = { a: 1, b: 2 };
    obj.self = obj;

    const result = prettyPrintToString(obj, { width: 80, useColor: false });

    expect(result).toBe("{a: 1, b: 2, self: [Circular]}");
  });

  it("should detect circular references in arrays", () => {
    const arr: unknown[] = [1, 2, 3];
    arr.push(arr);

    const result = prettyPrintToString(arr, { width: 80, useColor: false });

    expect(result).toBe("[1, 2, 3, [Circular]]");
  });

  it("should detect circular references in nested structures", () => {
    const parent: Record<string, unknown> = { name: "parent", children: [] };
    const child: Record<string, unknown> = { name: "child", parent: parent };
    (parent.children as unknown[]).push(child);

    const result = prettyPrintToString(parent, { width: 80, useColor: false });

    expect(result).toBe(
      '{name: "parent", children: [{name: "child", parent: [Circular]}]}',
    );
  });

  it("should print repeated references distinctly", () => {
    const shared = { value: 42 };
    const obj = { first: shared, second: shared };

    const result = prettyPrintToString(obj, { width: 80, useColor: false });

    expect(result).toBe("{first: {value: 42}, second: {value: 42}}");
  });

  it("should print JSX elements", () => {
    const element = React.createElement("div", { className: "foo" }, "hello");
    const result = prettyPrintToString(element, { width: 80, useColor: false });

    expect(result).toBe('<div className="foo">hello</div>');
  });

  it("should print JSX elements with no children", () => {
    const element = React.createElement("br", {});
    const result = prettyPrintToString(element, { width: 80, useColor: false });

    expect(result).toBe("<br />");
  });

  it("should print JSX elements with props and no children", () => {
    const element = React.createElement("img", {
      src: "test.png",
      alt: "test",
    });
    const result = prettyPrintToString(element, { width: 80, useColor: false });

    expect(result).toBe('<img src="test.png" alt="test" />');
  });

  it("should print nested JSX elements", () => {
    const element = React.createElement(
      "div",
      {},
      React.createElement("span", {}, "hello"),
      React.createElement("span", {}, "world"),
    );
    const result = prettyPrintToString(element, { width: 80, useColor: false });

    expect(result).toBe("<div><span>hello</span><span>world</span></div>");
  });

  it("should break props onto new lines when narrow", () => {
    const element = React.createElement("img", {
      src: "test.png",
      alt: "description",
      width: 100,
      height: 200,
    });
    const result = prettyPrintToString(element, { width: 30, useColor: false });

    expect(result).toContain("\n");
  });

  it("should extract type field as prefix by default", () => {
    const obj = { type: "person", name: "Alice" };
    const result = prettyPrintToString(obj, { width: 80, useColor: false });
    expect(result).toBe('{person name: "Alice"}');
  });

  it("should keep type as normal property when niceType is false", () => {
    const obj = { type: "person", name: "Alice" };
    const result = prettyPrintToString(obj, {
      width: 80,
      useColor: false,
      niceType: false,
    });
    expect(result).toBe('{type: "person", name: "Alice"}');
  });

  it("should extract id field as prefix by default", () => {
    const obj = { id: 42, name: "Alice" };
    const result = prettyPrintToString(obj, { width: 80, useColor: false });
    expect(result).toBe('{#42 name: "Alice"}');
  });

  it("should keep id as normal property when niceId is false", () => {
    const obj = { id: 42, name: "Alice" };
    const result = prettyPrintToString(obj, {
      width: 80,
      useColor: false,
      niceId: false,
    });
    expect(result).toBe('{id: 42, name: "Alice"}');
  });

  it("should extract both type and id as prefixes by default", () => {
    const obj = { type: "user", id: 1, name: "Alice" };
    const result = prettyPrintToString(obj, { width: 80, useColor: false });
    expect(result).toBe('{user#1 name: "Alice"}');
  });

  it("should keep both type and id as normal properties when disabled", () => {
    const obj = { type: "user", id: 1, name: "Alice" };
    const result = prettyPrintToString(obj, {
      width: 80,
      useColor: false,
      niceType: false,
      niceId: false,
    });
    expect(result).toBe('{type: "user", id: 1, name: "Alice"}');
  });

  it("should limit decimal places with precision", () => {
    const result = prettyPrintToString(3.14159, {
      useColor: false,
      precision: 2,
    });
    expect(result).toBe("3.14");
  });

  it("should format numbers with precision 0", () => {
    const result = prettyPrintToString(3.7, { useColor: false, precision: 0 });
    expect(result).toBe("4");
  });

  it("should not pad with zeros when precision exceeds decimal places", () => {
    const result = prettyPrintToString(1.5, { useColor: false, precision: 4 });
    expect(result).toBe("1.5");
  });

  it("should format numbers with significantDigits (toPrecision)", () => {
    const result = prettyPrintToString(3.14159, {
      useColor: false,
      significantDigits: 4,
    });
    expect(result).toBe("3.142");
  });

  it("should format large numbers with significantDigits", () => {
    const result = prettyPrintToString(123456, {
      useColor: false,
      significantDigits: 3,
    });
    expect(result).toBe("1.23e+5");
  });

  it("precision should take precedence over significantDigits", () => {
    const result = prettyPrintToString(3.14159, {
      useColor: false,
      precision: 1,
      significantDigits: 5,
    });
    expect(result).toBe("3.1");
  });

  it("should not apply precision to Infinity", () => {
    const result = prettyPrintToString(Infinity, {
      useColor: false,
      precision: 2,
    });
    expect(result).toBe("Infinity");
  });

  it("should not apply precision to NaN", () => {
    const result = prettyPrintToString(NaN, { useColor: false, precision: 2 });
    expect(result).toBe("NaN");
  });

  it("should not apply significantDigits to -Infinity", () => {
    const result = prettyPrintToString(-Infinity, {
      useColor: false,
      significantDigits: 3,
    });
    expect(result).toBe("-Infinity");
  });

  it("should apply precision to numbers inside objects and arrays", () => {
    const data = { values: [1.111, 2.222, 3.333] };
    const result = prettyPrintToString(data, {
      width: 80,
      useColor: false,
      precision: 1,
    });
    expect(result).toBe("{values: [1.1, 2.2, 3.3]}");
  });

  it("should not pad integers with precision", () => {
    const result = prettyPrintToString(42, { useColor: false, precision: 2 });
    expect(result).toBe("42");
  });

  it("should leave numbers unchanged when neither option is set", () => {
    const result = prettyPrintToString(3.14159, { useColor: false });
    expect(result).toBe("3.14159");
  });

  it("should keep opening tag together when it fits", () => {
    const element = React.createElement(
      "g",
      { "data-path": "/" },
      React.createElement("circle", { cx: 0, cy: 0 }),
    );
    const result = prettyPrintToString(element, { width: 20, useColor: false });

    // The opening tag should stay together if it fits
    expect(result).toBe(
      `<g data-path="/">
  <circle
    cx={0}
    cy={0}
  />
</g>`,
    );
  });

  it("should print nested JSX elements with color enabled", () => {
    // Nested JSX with children triggers the bug: phantom selfCloseTag/closeTag
    // spans get registered in tagger.tag() but never appear in the formatted
    // output, corrupting path-based marker matching in expand().
    const element = React.createElement(
      "g",
      { transform: "translate(0,0)" },
      React.createElement("rect", { width: 10, height: 20 }),
      React.createElement("text", { x: 5 }, "hello"),
    );

    expect(() =>
      prettyPrintToString(element, { width: 60, useColor: true }),
    ).not.toThrow();
  });
});
