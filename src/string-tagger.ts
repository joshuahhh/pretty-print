/**
 * A more general string tagging system that supports arbitrary Unicode characters.
 *
 * Instead of encoding color information directly into characters, this system:
 * 1. Assigns unique PUA (Private Use Area) codepoints to mark span starts
 * 2. Uses a single universal PUA codepoint to mark span ends
 * 3. Records the original characters and associated before/after strings separately
 * 4. Can expand the tagged string back to the original with tags applied
 */

// Use Unicode private use area for markers
const PUA_START = 0xe000;
const PUA_END = 0xf8ff; // End of BMP private use area
const END_MARKER = PUA_END; // Universal end marker
const MAX_MARKERS = PUA_END - PUA_START; // One less because we reserve END_MARKER

interface SpanInfo {
  startMarker: number; // PUA codepoint for start
  originalStart: string; // Original character at start position
  originalEnd: string | null; // Original character at end position, or null for single-char spans
  before: string; // String to insert before the span
  after: string; // String to insert after the span
}

export class StringTagger {
  private spans: Map<number, SpanInfo> = new Map();
  private nextMarkerIndex = 0;

  /**
   * Tags a substring by replacing the first and last characters
   * with unique PUA markers.
   *
   * @param text The text to tag (can be any Unicode)
   * @param before String to insert before the span when expanded
   * @param after String to insert after the span when expanded
   * @returns A string with same length, but first and last chars are PUA markers
   */
  tag(text: string, before: string, after: string): string {
    if (text.length === 0) {
      return text;
    }

    if (this.nextMarkerIndex >= MAX_MARKERS) {
      throw new Error(
        `Exceeded maximum number of tagged spans (${MAX_MARKERS})`
      );
    }

    // Get the next PUA codepoint for the start marker
    const startMarker = PUA_START + this.nextMarkerIndex;
    this.nextMarkerIndex++;

    // Record the original characters and before/after strings
    const originalStart = text[0];
    const originalEnd = text.length === 1 ? null : text[text.length - 1];

    this.spans.set(startMarker, {
      startMarker,
      originalStart,
      originalEnd,
      before,
      after,
    });

    // Build the result: marker + middle + marker
    if (originalEnd === null) {
      // Single character - just the start marker
      return String.fromCharCode(startMarker);
    }

    const middle = text.slice(1, -1);
    return (
      String.fromCharCode(startMarker) +
      middle +
      String.fromCharCode(END_MARKER)
    );
  }

  /**
   * Expands a tagged string back to the original text with before/after strings applied.
   *
   * @param encoded The string containing PUA markers
   * @returns The fully expanded string with before/after strings wrapped around tagged spans
   */
  expand(encoded: string): string {
    if (encoded.length === 0) {
      return encoded;
    }

    // Regex to find any PUA character (start markers or end marker)
    const puaRegex = /[\ue000-\uf8ff]/g;

    const parts: string[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = puaRegex.exec(encoded)) !== null) {
      const i = match.index;
      const charCode = encoded.charCodeAt(i);

      // Check if this is a start marker
      const spanInfo = this.spans.get(charCode);

      if (spanInfo) {
        // Copy any regular text before this marker
        if (i > lastIndex) {
          parts.push(encoded.slice(lastIndex, i));
        }

        // Found a tagged span
        if (spanInfo.originalEnd === null) {
          // Single-character span - no end marker to look for
          parts.push(spanInfo.before, spanInfo.originalStart, spanInfo.after);
          lastIndex = i + 1;
        } else {
          // Multi-character span - find the end marker
          const endIndex = encoded.indexOf(
            String.fromCharCode(END_MARKER),
            i + 1
          );

          if (endIndex === -1) {
            throw new Error("Tagged span missing end marker");
          }

          // Extract the middle part (between start marker and end marker)
          const middle = encoded.slice(i + 1, endIndex);

          // Build the expanded span
          parts.push(
            spanInfo.before,
            spanInfo.originalStart,
            middle,
            spanInfo.originalEnd,
            spanInfo.after
          );

          lastIndex = endIndex + 1;
          // Advance the regex past the end marker
          puaRegex.lastIndex = lastIndex;
        }
      } else {
        // Unrecognized PUA character - this is an error
        throw new Error(`Unrecognized PUA marker at index ${i}`);
      }
    }

    // Copy any remaining regular text
    if (lastIndex < encoded.length) {
      parts.push(encoded.slice(lastIndex));
    }

    return parts.join("");
  }
}
