import { create } from 'zustand'

// English meanings of the words in the word list, for the dictionary card.
// Built into public/hsk/meanings.tsv by scripts/build-hsk.mjs and only
// fetched once a card is first shown.

export interface Reading {
  // run together, e.g. dōngxi
  pinyin: string
  meanings: Array<string>
}

export type Dictionary = Map<string, Array<Reading>>

// lines of `word<TAB>pinyin<TAB>meanings` (meanings separated by `|`), or
// `word<TAB>=simplified` for a traditional word with the same readings
export function parseDictionary(text: string): Dictionary {
  const dictionary: Dictionary = new Map()
  const aliases: Array<[string, string]> = []
  for (const line of text.split('\n')) {
    const [word, pinyin, meanings] = line.split('\t')
    if (!word || !pinyin) continue
    if (pinyin.startsWith('=')) {
      aliases.push([word, pinyin.slice(1)])
      continue
    }
    const readings = dictionary.get(word) ?? []
    readings.push({ pinyin, meanings: meanings.split('|') })
    dictionary.set(word, readings)
  }
  for (const [word, simplified] of aliases) {
    const readings = dictionary.get(simplified)
    if (readings) dictionary.set(word, readings)
  }
  return dictionary
}

// The readings of a word, the one it has in the text (e.g. 还 hái rather than
// huán) first
export function lookUp(
  dictionary: Dictionary,
  word: string,
  pinyin: string,
): Array<Reading> {
  const readings = dictionary.get(word) ?? []
  // 一 and 不 are written as they're said in the text (see words.ts)
  const plain = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
  const rank = (reading: Reading) =>
    reading.pinyin === pinyin
      ? 0
      : plain(reading.pinyin) === plain(pinyin)
        ? 1
        : 2
  return [...readings].sort((a, b) => rank(a) - rank(b))
}

interface DictionaryState {
  dictionary: Dictionary | undefined
  load: () => void
}

let loading = false

export const useDictionaryStore = create<DictionaryState>()((set, get) => ({
  dictionary: undefined,
  load: async () => {
    if (get().dictionary || loading) return
    loading = true
    try {
      const res = await fetch('/hsk/meanings.tsv')
      if (!res.ok) throw new Error(`Meanings: ${res.status}`)
      set({ dictionary: parseDictionary(await res.text()) })
    } catch (err) {
      console.error(err)
    } finally {
      loading = false
    }
  },
}))
