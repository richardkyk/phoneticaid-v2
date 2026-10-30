import { getText } from './piece-table'
import type { PieceTable } from './piece-table'
import { isKnownWord } from './hsk'
import type { HskLevels, Lexicon } from './hsk'

// Splits the document into words and works out the pinyin for each character.
// Done per paragraph rather than per row, so words (and the pinyin worked out
// from their context) aren't cut up where a line wraps.
//
// Words and pinyin come from the word list (see hsk.ts): a listed word gets
// its own pinyin, anything else the usual reading of each character. Until
// it has loaded, words come from the browser's segmenter and there's no
// pinyin.

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

// Readings chosen with AI (see readings.ts): per paragraph text, the pinyin
// by offset in the paragraph. A paragraph that's been checked has an entry,
// even with nothing chosen.
export type ChosenReadings = Record<string, Record<number, string>>

const hasHan = (s: string) => /[一-鿿]/.test(s)

let segmenter: Intl.Segmenter | null = null
const getSegmenter = () =>
  (segmenter ??= new Intl.Segmenter('zh', { granularity: 'word' }))

interface ParagraphAnalysis {
  pinyin: Array<string>
  // [start, end) relative to the paragraph
  words: Array<[number, number]>
}

// Splits text into listed words and single characters, using the fewest
// pieces, then the most even lengths (e.g. 研究|生命 over 研究生|命).
// CC-CEDICT's words count as one piece fewer than their length, less a bit,
// so they're only used where HSK words would leave single characters (还书,
// but 经济|发展 rather than 经济发展).
const PIECE = 1000
const EXTRA_WORD_DISCOUNT = 500

function segmentWithLexicon(text: string, lexicon: Lexicon) {
  const n = text.length
  const cost = new Array<number>(n + 1).fill(Infinity)
  const from = new Array<number>(n + 1).fill(0)
  cost[0] = 0
  for (let i = 0; i < n; i++) {
    for (
      let length = 1;
      length <= lexicon.maxLength && i + length <= n;
      length++
    ) {
      const word = text.slice(i, i + length)
      if (length > 1 && !lexicon.words.has(word)) continue
      const pieces = lexicon.extra.has(word)
        ? PIECE * length - EXTRA_WORD_DISCOUNT
        : PIECE
      const c = cost[i] + pieces + length * length
      if (c < cost[i + length]) {
        cost[i + length] = c
        from[i + length] = i
      }
    }
  }
  const pieces: Array<[number, number]> = []
  for (let end = n; end > 0; end = from[end]) pieces.push([from[end], end])
  return pieces.reverse()
}

// 1-4, or 0 for the neutral tone (and syllables like the r of 儿)
function tone(syllable: string) {
  const mark = /[\u0304\u0301\u030c\u0300]/.exec(syllable.normalize('NFD'))
  return mark ? '\u0304\u0301\u030c\u0300'.indexOf(mark[0]) + 1 : 0
}

const DIGITS = '零〇一二三四五六七八九十'

// Changes the tones of 一 and 不 to how they're said, as textbooks write them
// (yí gè, yìqǐ, bú shì): 4th tone before a 4th tone, and 一 4th tone before
// the others. 一 keeps its own tone when it's counted or ordered (第一,
// 星期一, 一月, 十一) or ends a longer word (统一), and is neutral in 看一看.
// Before a neutral tone, the next character's own tone counts (一个 yí ge).
function applyToneSandhi(
  text: string,
  pinyin: Array<string>,
  words: Array<[number, number]>,
  lexicon: Lexicon,
) {
  const lastInWord = new Uint8Array(text.length)
  for (const [start, end] of words) {
    if (end - start > 1) lastInWord[end - 1] = 1
  }

  for (let i = 0; i < text.length - 1; i++) {
    const ch = text[i]
    const prev = i > 0 ? text[i - 1] : ''
    const next = text[i + 1]
    const nextTone = pinyin[i + 1]
      ? tone(pinyin[i + 1]) || tone(lexicon.pinyin.get(next) ?? '')
      : 0
    if (ch === '不' && pinyin[i] === 'bù' && nextTone === 4) {
      pinyin[i] = 'bú'
    }
    if (ch !== '一' || pinyin[i] !== 'yī') continue
    if (prev && prev === next) {
      pinyin[i] = 'yi'
      continue
    }
    const keep =
      !nextTone ||
      lastInWord[i] ||
      (prev && '第期拜周'.includes(prev)) ||
      '月号'.includes(next) ||
      (prev && DIGITS.includes(prev)) ||
      DIGITS.includes(next)
    if (!keep) pinyin[i] = nextTone === 4 ? 'yí' : 'yì'
  }
}

function analyseParagraph(
  text: string,
  lexicon: Lexicon | undefined,
  chosen: Record<number, string> | undefined,
): ParagraphAnalysis {
  // one entry per UTF-16 unit, like the cells (the placeholder is two)
  const pinyin: Array<string> = new Array(text.length).fill('')
  const words: Array<[number, number]> = []

  if (!lexicon) {
    for (const { segment, index, isWordLike } of getSegmenter().segment(text)) {
      if (isWordLike && hasHan(segment)) {
        words.push([index, index + segment.length])
      }
    }
    return { pinyin, words }
  }

  for (const [start, end] of segmentWithLexicon(text, lexicon)) {
    const word = text.slice(start, end)
    if (!hasHan(word)) continue
    words.push([start, end])
    const syllables = lexicon.pinyin.get(word)?.split(' ')
    for (let i = start; i < end; i++) {
      pinyin[i] = syllables?.[i - start] ?? lexicon.pinyin.get(text[i]) ?? ''
    }
  }
  for (const [offset, syllable] of Object.entries(chosen ?? {})) {
    pinyin[Number(offset)] = syllable
  }
  applyToneSandhi(text, pinyin, words, lexicon)
  return { pinyin, words }
}

// segmenting is slow, so paragraphs are only redone when they
// change (or the word list loads)
let paragraphCache = new Map<string, ParagraphAnalysis>()
let cachedLexicon: Lexicon | undefined
const MAX_CACHED_PARAGRAPHS = 2000

function cachedParagraph(
  text: string,
  lexicon: Lexicon | undefined,
  chosen: Record<number, string> | undefined,
) {
  if (lexicon !== cachedLexicon) {
    paragraphCache = new Map()
    cachedLexicon = lexicon
  }
  const key = chosen ? `${text}\u0000${JSON.stringify(chosen)}` : text
  let analysis = paragraphCache.get(key)
  if (!analysis) {
    if (paragraphCache.size >= MAX_CACHED_PARAGRAPHS) paragraphCache.clear()
    analysis = analyseParagraph(text, lexicon, chosen)
    paragraphCache.set(key, analysis)
  }
  return analysis
}

export function analyseText(
  text: string,
  lexicon?: Lexicon,
  chosen?: ChosenReadings,
): TextAnalysis {
  const py: Array<string> = new Array(text.length).fill('')
  const words: Array<Word> = []
  const wordAt = new Int32Array(text.length).fill(-1)

  let offset = 0
  for (const paragraph of text.split('\n')) {
    const analysis = cachedParagraph(paragraph, lexicon, chosen?.[paragraph])
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

let cache: {
  pt: PieceTable
  lexicon: Lexicon | undefined
  chosen: ChosenReadings | undefined
  analysis: TextAnalysis
} | null = null

// Memoised by piece table identity, like getLayout
export function getAnalysis(
  pt: PieceTable,
  lexicon: Lexicon | undefined,
  chosen?: ChosenReadings,
): TextAnalysis {
  if (
    cache &&
    cache.pt === pt &&
    cache.lexicon === lexicon &&
    cache.chosen === chosen
  ) {
    return cache.analysis
  }
  const analysis = analyseText(getText(pt), lexicon, chosen)
  cache = { pt, lexicon, chosen, analysis }
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
