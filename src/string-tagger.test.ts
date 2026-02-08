import { describe, expect, it } from "vitest";
import { StringTagger } from "./string-tagger.js";

describe("StringTagger", () => {
  describe("tag", () => {
    it("should preserve string length for multi-char strings", () => {
      const tagger = new StringTagger();
      const result = tagger.tag("hello", "<b>", "</b>", [0]);
      expect(result.length).toBe("hello".length);
    });

    it("should preserve string length for single-char strings", () => {
      const tagger = new StringTagger();
      const result = tagger.tag("x", "<b>", "</b>", [0]);
      expect(result.length).toBe(1);
    });

    it("should preserve string length for two-char strings", () => {
      const tagger = new StringTagger();
      const result = tagger.tag("ab", "<b>", "</b>", [0]);
      expect(result.length).toBe(2);
    });

    it("should return empty string for empty input", () => {
      const tagger = new StringTagger();
      const result = tagger.tag("", "<b>", "</b>", [0]);
      expect(result).toBe("");
    });

    it("should preserve middle characters", () => {
      const tagger = new StringTagger();
      const result = tagger.tag("hello", "<b>", "</b>", [0]);
      // middle characters "ell" should be preserved
      expect(result.slice(1, -1)).toBe("ell");
    });
  });

  describe("expand", () => {
    it("should wrap a multi-char string with before/after", () => {
      const tagger = new StringTagger();
      const tagged = tagger.tag("hello", "<b>", "</b>", [0]);
      const expanded = tagger.expand(tagged);
      expect(expanded).toBe("<b>hello</b>");
    });

    it("should wrap a single-char string with before/after", () => {
      const tagger = new StringTagger();
      const tagged = tagger.tag("x", "[", "]", [0]);
      const expanded = tagger.expand(tagged);
      expect(expanded).toBe("[x]");
    });

    it("should wrap a two-char string with before/after", () => {
      const tagger = new StringTagger();
      const tagged = tagger.tag("ab", "(", ")", [0]);
      const expanded = tagger.expand(tagged);
      expect(expanded).toBe("(ab)");
    });

    it("should handle empty before/after strings", () => {
      const tagger = new StringTagger();
      const tagged = tagger.tag("hello", "", "", [0]);
      const expanded = tagger.expand(tagged);
      expect(expanded).toBe("hello");
    });

    it("should return empty string for empty input", () => {
      const tagger = new StringTagger();
      const expanded = tagger.expand("");
      expect(expanded).toBe("");
    });

    it("should handle multiple tagged spans in sequence", () => {
      const tagger = new StringTagger();
      const a = tagger.tag("hello", "<a>", "</a>", [0]);
      const b = tagger.tag("world", "<b>", "</b>", [1]);
      const expanded = tagger.expand(a + " " + b);
      expect(expanded).toBe("<a>hello</a> <b>world</b>");
    });

    it("should handle many tagged spans", () => {
      const tagger = new StringTagger();
      const parts: string[] = [];
      for (let i = 0; i < 100; i++) {
        parts.push(tagger.tag(`w${i}`, `<${i}>`, `</${i}>`, [i]));
      }
      const expanded = tagger.expand(parts.join(","));
      for (let i = 0; i < 100; i++) {
        expect(expanded).toContain(`<${i}>w${i}</${i}>`);
      }
    });

    it("should handle tagged spans mixed with plain text", () => {
      const tagger = new StringTagger();
      const tagged = tagger.tag("bold", "<b>", "</b>", [0]);
      const expanded = tagger.expand("plain " + tagged + " also plain");
      expect(expanded).toBe("plain <b>bold</b> also plain");
    });

    it("should handle adjacent tagged spans with no gap", () => {
      const tagger = new StringTagger();
      const a = tagger.tag("red", "<r>", "</r>", [0]);
      const b = tagger.tag("blue", "<b>", "</b>", [1]);
      const expanded = tagger.expand(a + b);
      expect(expanded).toBe("<r>red</r><b>blue</b>");
    });

    it("should handle adjacent single-char tagged spans", () => {
      const tagger = new StringTagger();
      const a = tagger.tag("x", "(", ")", [0]);
      const b = tagger.tag("y", "[", "]", [1]);
      const expanded = tagger.expand(a + b);
      expect(expanded).toBe("(x)[y]");
    });

    it("should handle unicode content", () => {
      const tagger = new StringTagger();
      const tagged = tagger.tag("café", "<i>", "</i>", [0]);
      const expanded = tagger.expand(tagged);
      expect(expanded).toBe("<i>café</i>");
    });
  });

  describe("tag + expand roundtrip with ANSI codes", () => {
    const ANSI_GREEN = "\x1b[32m";
    const ANSI_RESET = "\x1b[0m";

    it("should produce correct ANSI-wrapped output", () => {
      const tagger = new StringTagger();
      const tagged = tagger.tag('"hello"', ANSI_GREEN, ANSI_RESET, [0]);
      const expanded = tagger.expand(tagged);
      expect(expanded).toBe(`${ANSI_GREEN}"hello"${ANSI_RESET}`);
    });

    it("should not affect line width measurement", () => {
      const tagger = new StringTagger();
      const tagged = tagger.tag("hello", ANSI_GREEN, ANSI_RESET, [0]);
      expect(tagged.length).toBe("hello".length);
    });
  });

  describe("path-based ordering", () => {
    it("should expand correctly when tagged out of order (paths determine order)", () => {
      const tagger = new StringTagger();
      // Tag in order a, b, c — but paths say the string order is c, a, b
      const a = tagger.tag("first", "<a>", "</a>", [1]);
      const b = tagger.tag("second", "<b>", "</b>", [2]);
      const c = tagger.tag("third", "<c>", "</c>", [0]);
      // Assemble in string order matching paths: c ([0]), a ([1]), b ([2])
      const expanded = tagger.expand(c + " " + a + " " + b);
      expect(expanded).toBe("<c>third</c> <a>first</a> <b>second</b>");
    });

    it("should expand correctly when single-char tags are out of order", () => {
      const tagger = new StringTagger();
      const a = tagger.tag("x", "(", ")", [1]);
      const b = tagger.tag("y", "[", "]", [0]);
      // String order: b first, a second (matching paths [0], [1])
      const expanded = tagger.expand(b + a);
      expect(expanded).toBe("[y](x)");
    });

    it("should sort hierarchical paths correctly", () => {
      const tagger = new StringTagger();
      // Simulate a nested structure: key0: val0, key1: val1
      const k0 = tagger.tag("key0", "<k>", "</k>", [0, 0]);
      const v0 = tagger.tag("val0", "<v>", "</v>", [0, 1]);
      const k1 = tagger.tag("key1", "<k>", "</k>", [1, 0]);
      const v1 = tagger.tag("val1", "<v>", "</v>", [1, 1]);
      const expanded = tagger.expand(k0 + ": " + v0 + ", " + k1 + ": " + v1);
      expect(expanded).toBe(
        "<k>key0</k>: <v>val0</v>, <k>key1</k>: <v>val1</v>",
      );
    });

    it("should handle hierarchical paths tagged in arbitrary order", () => {
      const tagger = new StringTagger();
      // Tag in reverse order
      const v1 = tagger.tag("val1", "<v>", "</v>", [1, 1]);
      const k1 = tagger.tag("key1", "<k>", "</k>", [1, 0]);
      const v0 = tagger.tag("val0", "<v>", "</v>", [0, 1]);
      const k0 = tagger.tag("key0", "<k>", "</k>", [0, 0]);
      // Assemble in correct string order
      const expanded = tagger.expand(k0 + ": " + v0 + ", " + k1 + ": " + v1);
      expect(expanded).toBe(
        "<k>key0</k>: <v>val0</v>, <k>key1</k>: <v>val1</v>",
      );
    });
  });

  describe("interaction with string operations", () => {
    it("should survive concatenation and still expand correctly", () => {
      const tagger = new StringTagger();
      const a = tagger.tag("key", "<k>", "</k>", [0]);
      const b = tagger.tag('"value"', "<v>", "</v>", [1]);
      const line = "{ " + a + ": " + b + " }";
      const expanded = tagger.expand(line);
      expect(expanded).toBe('{ <k>key</k>: <v>"value"</v> }');
    });

    it("should survive being split across lines and rejoined", () => {
      const tagger = new StringTagger();
      const a = tagger.tag("hello", "<a>", "</a>", [0]);
      const b = tagger.tag("world", "<b>", "</b>", [1]);
      const text = a + "\n" + b;
      const expanded = tagger.expand(text);
      expect(expanded).toBe("<a>hello</a>\n<b>world</b>");
    });
  });
});
