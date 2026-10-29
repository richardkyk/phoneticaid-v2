import { pinyin } from 'pinyin'
import { getText } from './piece-table'
import type { PieceTable } from './piece-table'
import { isKnownWord } from './hsk'
import type { HskLevels } from './hsk'

// Splits the document into words and works out the pinyin for each character.
// Done per paragraph rather than per row, so words (and the pinyin worked out
// from their context) aren't cut up where a line wraps.

export interface Word {
  // absolute offsets, end is exclusive
  start: number
  end: number
  text: string
}

export interface TextAnalysis {
  // pinyin for each character, '' for characters without any
  pinyin: Array<string>
  // words containing Chinese characters, in document order
  words: Array<Word>
  // index into `words` of the word each character belongs to, -1 for none
  wordAt: Int32Array
}

export type PinyinMode = 'all' | 'unknown' | 'none'

const hasHan = (s: string) => /[一-鿿]/.test(s)

let segmenter: Intl.Segmenter | null = null
const getSegmenter = () =>
  (segmenter ??= new Intl.Segmenter('zh', { granularity: 'word' }))

interface ParagraphAnalysis {
  pinyin: Array<string>
  // [start, end) relative to the paragraph
  words: Array<[number, number]>
}

function paragraphPinyin(text: string) {
  const py = pinyin(
    // the placeholder is two UTF-16 units, like the cells it's drawn in
    text.replace(/\u{E0000}/gu, '母 ').replace(/[^一-鿿]/g, ' '),
    { segment: true },
  ).flatMap(([s]) => {
    // check for Latin or accented letters (for pinyin)
    const hasPinyin = /[a-zA-ZÀ-ſ]/.test(s)
    if (hasPinyin) return [s]
    // otherwise split each character into an empty string placeholder
    return Array.from(s).map(() => '')
  })
  // one entry per character, whatever the segmenter did
  return Array.from({ length: text.length }, (_, i) => py[i] ?? '')
}

function analyseParagraph(text: string): ParagraphAnalysis {
  const words: Array<[number, number]> = []
  for (const { segment, index, isWordLike } of getSegmenter().segment(text)) {
    if (isWordLike && hasHan(segment)) {
      words.push([index, index + segment.length])
    }
  }
  return { pinyin: paragraphPinyin(text), words }
}

// working out the pinyin is slow, so paragraphs are only redone when they change
const paragraphCache = new Map<string, ParagraphAnalysis>()
const MAX_CACHED_PARAGRAPHS = 2000

function cachedParagraph(text: string) {
  let analysis = paragraphCache.get(text)
  if (!analysis) {
    if (paragraphCache.size >= MAX_CACHED_PARAGRAPHS) paragraphCache.clear()
    analysis = analyseParagraph(text)
    paragraphCache.set(text, analysis)
  }
  return analysis
}

export function analyseText(text: string): TextAnalysis {
  const py: Array<string> = new Array(text.length).fill('')
  const words: Array<Word> = []
  const wordAt = new Int32Array(text.length).fill(-1)

  let offset = 0
  for (const paragraph of text.split('\n')) {
    const analysis = cachedParagraph(paragraph)
    for (let i = 0; i < paragraph.length; i++) {
      py[offset + i] = analysis.pinyin[i]
    }
    for (const [start, end] of analysis.words) {
      for (let i = start; i < end; i++) wordAt[offset + i] = words.length
      words.push({
        start: offset + start,
        end: offset + end,
        text: paragraph.slice(start, end),
      })
    }
    // skip the newline
    offset += paragraph.length + 1
  }

  return { pinyin: py, words, wordAt }
}

let cache: { pt: PieceTable; analysis: TextAnalysis } | null = null

// Memoised by piece table identity, like getLayout
export function getAnalysis(pt: PieceTable): TextAnalysis {
  if (cache && cache.pt === pt) return cache.analysis
  const analysis = analyseText(getText(pt))
  cache = { pt, analysis }
  return analysis
}

// Which characters have their pinyin hidden (1 = hidden), or null if none
// are. With 'unknown', pinyin is only shown for words above `maxLevel`.
export function hiddenPinyin(
  analysis: TextAnalysis,
  mode: PinyinMode,
  levels: HskLevels | undefined,
  maxLevel: number,
): Uint8Array | null {
  const length = analysis.pinyin.length
  if (mode === 'all') return null
  if (mode === 'none') return new Uint8Array(length).fill(1)
  // everything is shown until the word list has loaded
  if (!levels) return null

  const hidden = new Uint8Array(length)
  for (const word of analysis.words) {
    if (isKnownWord(word.text, levels, maxLevel)) {
      hidden.fill(1, word.start, word.end)
    }
  }
  return hidden
}

// The pinyin of the text from start to end, with the syllables of a word
// run together and words separated by spaces (e.g. "wǒ xǐhuān yínháng")
export function rangePinyin(
  analysis: TextAnalysis,
  start: number,
  end: number,
) {
  let result = ''
  let lastWord = -1
  for (let i = start; i < end; i++) {
    const py = analysis.pinyin[i]
    if (!py) {
      lastWord = -1
      continue
    }
    const word = analysis.wordAt[i]
    if (result && (word === -1 || word !== lastWord)) result += ' '
    result += py
    lastWord = word
  }
  return result
}
