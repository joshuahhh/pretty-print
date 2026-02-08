import { describe, expect, it } from "vitest";
import { StringTagger } from "./string-tagger.js";

describe("StringTagger", () => {
  describe("tag", () => {
    it("should preserve string length for multi-char strings", () => {
      const tagger = new StringTagger();
      const result = tagger.tag("hello", "<b>", "</b>");
      expect(result.length).toBe("hello".length);
    });

    it("should preserve string length for single-char strings", () => {
      const tagger = new StringTagger();
      const result = tagger.tag("x", "<b>", "</b>");
      expect(result.length).toBe(1);
    });

    it("should preserve string length for two-char strings", () => {
      const tagger = new StringTagger();
      const result = tagger.tag("ab", "<b>", "</b>");
      expect(result.length).toBe(2);
    });

    it("should return empty string for empty input", () => {
      const tagger = new StringTagger();
      const result = tagger.tag("", "<b>", "</b>");
      expect(result).toBe("");
    });

    it("should preserve middle characters", () => {
      const tagger = new StringTagger();
      const result = tagger.tag("hello", "<b>", "</b>");
      // middle characters "ell" should be preserved
      expect(result.slice(1, -1)).toBe("ell");
    });
  });

  describe("expand", () => {
    it("should wrap a multi-char string with before/after", () => {
      const tagger = new StringTagger();
      const tagged = tagger.tag("hello", "<b>", "</b>");
      const expanded = tagger.expand(tagged);
      expect(expanded).toBe("<b>hello</b>");
    });

    it("should wrap a single-char string with before/after", () => {
      const tagger = new StringTagger();
      const tagged = tagger.tag("x", "[", "]");
      const expanded = tagger.expand(tagged);
      expect(expanded).toBe("[x]");
    });

    it("should wrap a two-char string with before/after", () => {
      const tagger = new StringTagger();
      const tagged = tagger.tag("ab", "(", ")");
      const expanded = tagger.expand(tagged);
      expect(expanded).toBe("(ab)");
    });

    it("should handle empty before/after strings", () => {
      const tagger = new StringTagger();
      const tagged = tagger.tag("hello", "", "");
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
      const a = tagger.tag("hello", "<a>", "</a>");
      const b = tagger.tag("world", "<b>", "</b>");
      const expanded = tagger.expand(a + " " + b);
      expect(expanded).toBe("<a>hello</a> <b>world</b>");
    });

    it("should handle many tagged spans", () => {
      const tagger = new StringTagger();
      const parts: string[] = [];
      for (let i = 0; i < 100; i++) {
        parts.push(tagger.tag(`w${i}`, `<${i}>`, `</${i}>`));
      }
      const expanded = tagger.expand(parts.join(","));
      for (let i = 0; i < 100; i++) {
        expect(expanded).toContain(`<${i}>w${i}</${i}>`);
      }
    });

    it("should handle tagged spans mixed with plain text", () => {
      const tagger = new StringTagger();
      const tagged = tagger.tag("bold", "<b>", "</b>");
      const expanded = tagger.expand("plain " + tagged + " also plain");
      expect(expanded).toBe("plain <b>bold</b> also plain");
    });

    it("should handle adjacent tagged spans with no gap", () => {
      const tagger = new StringTagger();
      const a = tagger.tag("red", "<r>", "</r>");
      const b = tagger.tag("blue", "<b>", "</b>");
      const expanded = tagger.expand(a + b);
      expect(expanded).toBe("<r>red</r><b>blue</b>");
    });

    it("should handle adjacent single-char tagged spans", () => {
      const tagger = new StringTagger();
      const a = tagger.tag("x", "(", ")");
      const b = tagger.tag("y", "[", "]");
      const expanded = tagger.expand(a + b);
      expect(expanded).toBe("(x)[y]");
    });

    it("should handle unicode content", () => {
      const tagger = new StringTagger();
      const tagged = tagger.tag("café", "<i>", "</i>");
      const expanded = tagger.expand(tagged);
      expect(expanded).toBe("<i>café</i>");
    });
  });

  describe("tag + expand roundtrip with ANSI codes", () => {
    const ANSI_GREEN = "\x1b[32m";
    const ANSI_RESET = "\x1b[0m";

    it("should produce correct ANSI-wrapped output", () => {
      const tagger = new StringTagger();
      const tagged = tagger.tag('"hello"', ANSI_GREEN, ANSI_RESET);
      const expanded = tagger.expand(tagged);
      expect(expanded).toBe(`${ANSI_GREEN}"hello"${ANSI_RESET}`);
    });

    it("should not affect line width measurement", () => {
      const tagger = new StringTagger();
      const tagged = tagger.tag("hello", ANSI_GREEN, ANSI_RESET);
      // The tagged string should be the same length as the original
      expect(tagged.length).toBe("hello".length);
    });
  });

  describe("interaction with string operations", () => {
    it("should survive concatenation and still expand correctly", () => {
      const tagger = new StringTagger();
      const a = tagger.tag("key", "<k>", "</k>");
      const b = tagger.tag('"value"', "<v>", "</v>");
      const line = "{ " + a + ": " + b + " }";
      const expanded = tagger.expand(line);
      expect(expanded).toBe('{ <k>key</k>: <v>"value"</v> }');
    });

    it("should expand correctly when tagged strings are combined out of order", () => {
      const tagger = new StringTagger();
      const a = tagger.tag("first", "<a>", "</a>");
      const b = tagger.tag("second", "<b>", "</b>");
      const c = tagger.tag("third", "<c>", "</c>");
      // Combine in reverse order from how they were tagged
      const expanded = tagger.expand(c + " " + a + " " + b);
      expect(expanded).toBe("<c>third</c> <a>first</a> <b>second</b>");
    });

    it("should expand correctly when single-char tags are combined out of order", () => {
      const tagger = new StringTagger();
      const a = tagger.tag("x", "(", ")");
      const b = tagger.tag("y", "[", "]");
      // Reverse order
      const expanded = tagger.expand(b + a);
      expect(expanded).toBe("[y](x)");
    });

    it("should survive being split across lines and rejoined", () => {
      const tagger = new StringTagger();
      const a = tagger.tag("hello", "<a>", "</a>");
      const b = tagger.tag("world", "<b>", "</b>");
      const text = a + "\n" + b;
      const expanded = tagger.expand(text);
      expect(expanded).toBe("<a>hello</a>\n<b>world</b>");
    });
  });
});
