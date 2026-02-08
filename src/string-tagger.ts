/**
 * A string tagging system that supports arbitrary Unicode characters.
 *
 * This system:
 * 1. Replaces the first/last characters of tagged spans with fixed PUA markers
 * 2. Records the original characters and associated before/after strings separately
 * 3. Uses a caller-provided path (number[]) to determine the left-to-right order of spans
 * 4. Can expand the tagged string back to the original with tags applied
 *
 * The path-based approach means callers can tag() in any order — expand() sorts
 * spans by path to match them with markers left-to-right in the string.
 */

// Two fixed PUA codepoints — that's all we need
const START_MARKER = 0xe000;
const END_MARKER = 0xe001;

export type TagPath = number[];

interface SpanInfo {
  path: TagPath;
  originalStart: string; // Original character at start position
  originalEnd: string | null; // Original character at end position, or null for single-char spans
  before: string; // String to insert before the span
  after: string; // String to insert after the span
}

function comparePaths(a: TagPath, b: TagPath): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

export class StringTagger {
  private spans: SpanInfo[] = [];

  /**
   * Tags a substring by replacing the first and last characters with PUA markers.
   *
   * @param text The text to tag (can be any Unicode)
   * @param before String to insert before the span when expanded
   * @param after String to insert after the span when expanded
   * @param path A number[] that determines this span's left-to-right position.
   *   Paths are compared element-wise — spans with earlier paths are matched
   *   to earlier (leftward) markers in the string.
   * @returns A string with same length, but first and last chars are PUA markers
   */
  tag(text: string, before: string, after: string, path: TagPath): string {
    if (text.length === 0) {
      return text;
    }

    const originalStart = text[0];
    const originalEnd = text.length === 1 ? null : text[text.length - 1];

    this.spans.push({ path, originalStart, originalEnd, before, after });

    if (originalEnd === null) {
      return String.fromCharCode(START_MARKER);
    }

    const middle = text.slice(1, -1);
    return (
      String.fromCharCode(START_MARKER) +
      middle +
      String.fromCharCode(END_MARKER)
    );
  }

  /**
   * Expands a tagged string back to the original text with before/after strings applied.
   *
   * Spans are matched to markers by sorting paths element-wise — the span with
   * the earliest path is matched to the leftmost START_MARKER in the string.
   *
   * @param encoded The string containing PUA markers
   * @returns The fully expanded string with before/after strings wrapped around tagged spans
   */
  expand(encoded: string): string {
    if (encoded.length === 0) {
      return encoded;
    }

    // Sort spans by path — this determines left-to-right marker assignment
    const sortedSpans = [...this.spans].sort((a, b) =>
      comparePaths(a.path, b.path),
    );

    let spanIndex = 0;
    const parts: string[] = [];
    let lastIndex = 0;

    for (let i = 0; i < encoded.length; i++) {
      const charCode = encoded.charCodeAt(i);

      if (charCode === START_MARKER) {
        // Copy any regular text before this marker
        if (i > lastIndex) {
          parts.push(encoded.slice(lastIndex, i));
        }

        const spanInfo = sortedSpans[spanIndex++];
        if (!spanInfo) {
          throw new Error("More start markers in string than registered spans");
        }

        if (spanInfo.originalEnd === null) {
          // Single-character span
          parts.push(spanInfo.before, spanInfo.originalStart, spanInfo.after);
          lastIndex = i + 1;
        } else {
          // Multi-character span — find the end marker
          const endIndex = encoded.indexOf(
            String.fromCharCode(END_MARKER),
            i + 1,
          );
          if (endIndex === -1) {
            throw new Error("Tagged span missing end marker");
          }

          const middle = encoded.slice(i + 1, endIndex);
          parts.push(
            spanInfo.before,
            spanInfo.originalStart,
            middle,
            spanInfo.originalEnd,
            spanInfo.after,
          );

          lastIndex = endIndex + 1;
          i = endIndex; // skip past end marker
        }
      } else if (charCode === END_MARKER) {
        throw new Error(`Unexpected end marker at index ${i}`);
      }
    }

    // Copy any remaining regular text
    if (lastIndex < encoded.length) {
      parts.push(encoded.slice(lastIndex));
    }

    return parts.join("");
  }
}
