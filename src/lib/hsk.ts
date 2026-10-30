import { create } from 'zustand'

// The word list (HSK 2.0 and 3.0 words with their pinyin and HSK 3.0 level),
// built into public/hsk by scripts/build-hsk.mjs and fetched when a project
// is opened (the browser caches it after that). It's used to split text into
// words, for the pinyin of words, and for hiding the pinyin of known words.

// word -> the lowest HSK 3.0 level it appears in (levels 7-9 are level 7)
export type HskLevels = Map<string, number>

export interface Lexicon {
  // every listed word
  words: Set<string>
  levels: HskLevels
  // pinyin for each character of a word of two or more characters
  pinyin: Map<string, Array<string>>
  // length of the longest word, in UTF-16 units
  maxLength: number
}

// lines of `word<TAB>pinyin<TAB>level`, the pinyin one syllable per character
export function parseLexicon(text: string): Lexicon {
  const lexicon: Lexicon = {
    words: new Set(),
    levels: new Map(),
    pinyin: new Map(),
    maxLength: 1,
  }
  for (const line of text.split('\n')) {
    const [word, pinyin, level] = line.split('\t')
    if (!word) continue
    lexicon.words.add(word)
    lexicon.maxLength = Math.max(lexicon.maxLength, word.length)
    if (level) lexicon.levels.set(word, Number(level))
    const syllables = pinyin ? pinyin.split(' ') : []
    if (word.length > 1 && syllables.length === word.length) {
      lexicon.pinyin.set(word, syllables)
    }
  }
  return lexicon
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
      const res = await fetch('/hsk/words.tsv')
      if (!res.ok) throw new Error(`Word list: ${res.status}`)
      set({ lexicon: parseLexicon(await res.text()) })
    } catch (err) {
      console.error(err)
    } finally {
      loading = false
    }
  },
}))
