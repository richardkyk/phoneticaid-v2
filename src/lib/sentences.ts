// What a sentence ends with, and the closing quotes and brackets that can
// follow it
const ENDS = '。！？!?；;…\n'
const CLOSERS = '”’」』）)"\''

// [start, end) of the sentence around the character at `index`: from after
// the previous sentence's end to its own (with any closing quotes), without
// the spaces around it
export function sentenceAt(text: string, index: number): [number, number] {
  let start = index
  while (start > 0 && !ENDS.includes(text[start - 1])) start--
  // closing quotes belong to the previous sentence
  while (start < index && CLOSERS.includes(text[start])) start++

  let end = index
  while (end < text.length && !ENDS.includes(text[end])) end++
  if (end < text.length && text[end] !== '\n') {
    end++
    // more of the same mark (！！, ……) and closing quotes
    while (
      end < text.length &&
      ENDS.includes(text[end]) &&
      text[end] !== '\n'
    ) {
      end++
    }
    while (end < text.length && CLOSERS.includes(text[end])) end++
  }

  while (start < end && /\s/.test(text[start])) start++
  while (end > start && /\s/.test(text[end - 1])) end--
  return [start, end]
}
