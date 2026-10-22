/**
 * URL-encodes user text without throwing on malformed UTF-16.
 *
 * JavaScript strings may contain an unpaired surrogate (clipboard content, malformed IPC input,
 * hostile page text). `encodeURIComponent` throws for those values; replacing only the malformed
 * code units with U+FFFD keeps navigation/search alive while preserving valid Unicode.
 */
export function encodeUrlComponent(value: string): string {
  const wellFormed = value.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    '\uFFFD'
  )
  return encodeURIComponent(wellFormed)
}
