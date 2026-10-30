import { create } from 'zustand'

// The word list (HSK 2.0 and 3.0 words with their pinyin and HSK 3.0 level,
// and the usual reading of every other character), built into public/hsk by
// scripts/build-hsk.mjs and fetched when a project is opened (the browser
// caches it after that). It's used to split text into words, for pinyin, and
// for hiding the pinyin of known words.
//
// Once it's loaded, the rest of CC-CEDICT's words (public/dict/words.tsv,
// built by scripts/build-cedict.mjs) are added to it, for words outside HSK
// (e.g. 还书 huán shū).

// word -> the lowest HSK 3.0 level it appears in (levels 7-9 are level 7)
export type HskLevels = Map<string, number>

export interface Lexicon {
  // every listed word
  words: Set<string>
  // the words from CC-CEDICT rather than the HSK list
  extra: Set<string>
  levels: HskLevels
  // pinyin for each character of a word, separated by spaces
  pinyin: Map<string, string>
  // length of the longest word, in UTF-16 units
  maxLength: number
}

// lines of `word<TAB>pinyin<TAB>level`, the pinyin one syllable per character
export function parseLexicon(text: string): Lexicon {
  const lexicon: Lexicon = {
    words: new Set(),
    extra: new Set(),
    levels: new Map(),
    pinyin: new Map(),
    maxLength: 1,
  }
  addWords(lexicon, text, false)
  return lexicon
}

// A copy of the lexicon with the extra words (lines of `word<TAB>pinyin`)
export function extendLexicon(lexicon: Lexicon, text: string): Lexicon {
  const extended: Lexicon = {
    words: new Set(lexicon.words),
    extra: new Set(lexicon.extra),
    levels: lexicon.levels,
    pinyin: new Map(lexicon.pinyin),
    maxLength: lexicon.maxLength,
  }
  addWords(extended, text, true)
  return extended
}

function addWords(lexicon: Lexicon, text: string, extra: boolean) {
  for (const line of text.split('\n')) {
    const [word, pinyin, level] = line.split('\t')
    if (!word || (extra && lexicon.words.has(word))) continue
    lexicon.words.add(word)
    if (extra) lexicon.extra.add(word)
    lexicon.maxLength = Math.max(lexicon.maxLength, word.length)
    if (level) lexicon.levels.set(word, Number(level))
    if (pinyin && pinyin.split(' ').length === word.length) {
      lexicon.pinyin.set(word, pinyin)
    }
  }
}

const isHan = (ch: string) => /[一-鿿]/.test(ch)

// Whether a word is at or below `maxLevel`. Words that aren't in the list are
// known if all of their characters are.
export function isKnownWord(
  word: string,
  levels: HskLevels,
  maxLevel: number,
): boolean {
  const level = levels.get(word)
  if (level !== undefined) return level <= maxLevel
  const chars = Array.from(word).filter(isHan)
  // an unlisted character is unknown
  if (chars.length < 2) return false
  return chars.every((ch) => (levels.get(ch) ?? Infinity) <= maxLevel)
}

interface LexiconState {
  lexicon: Lexicon | undefined
  load: () => void
}

let loading = false

export const useLexiconStore = create<LexiconState>()((set, get) => ({
  lexicon: undefined,
  load: async () => {
    if (get().lexicon || loading) return
    loading = true
    try {
      const lexicon = parseLexicon(await fetchText('/hsk/words.tsv'))
      set({ lexicon })
      // the rest of the words come after, as they're a much bigger download
      set({
        lexicon: extendLexicon(lexicon, await fetchText('/dict/words.tsv')),
      })
    } catch (err) {
      console.error(err)
    } finally {
      loading = false
    }
  },
}))

async function fetchText(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  return res.text()
}
