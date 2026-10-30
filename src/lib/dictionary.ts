import { create } from 'zustand'

// English meanings of words from CC-CEDICT, for the dictionary card. Built
// into public/dict/meanings by scripts/build-cedict.mjs, split by the first
// character so a card only fetches a small part of it.

export interface Reading {
  // run together, e.g. dōngxi
  pinyin: string
  meanings: Array<string>
}

export type Dictionary = Map<string, Array<Reading>>

// must match SHARDS in scripts/build-cedict.mjs
const SHARDS = 64

// which part of the dictionary has a word
export const shardOf = (word: string) => (word.codePointAt(0) ?? 0) % SHARDS

// lines of `word<TAB>pinyin<TAB>meanings`, the meanings separated by `|`
export function parseDictionary(text: string): Dictionary {
  const dictionary: Dictionary = new Map()
  for (const line of text.split('\n')) {
    const [word, pinyin, meanings] = line.split('\t')
    if (!word || !pinyin) continue
    const readings = dictionary.get(word) ?? []
    readings.push({ pinyin, meanings: meanings.split('|') })
    dictionary.set(word, readings)
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
      .replace(/[̀-ͯ]/g, '')
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
  // the parts of the dictionary fetched so far
  shards: Partial<Record<number, Dictionary>>
  load: (shard: number) => void
}

const loading = new Set<number>()

export const useDictionaryStore = create<DictionaryState>()((set, get) => ({
  shards: {},
  load: async (shard) => {
    if (get().shards[shard] || loading.has(shard)) return
    loading.add(shard)
    try {
      const url = `/dict/meanings/${String(shard).padStart(2, '0')}.txt`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${url}: ${res.status}`)
      const dictionary = parseDictionary(await res.text())
      set({ shards: { ...get().shards, [shard]: dictionary } })
    } catch (err) {
      console.error(err)
    } finally {
      loading.delete(shard)
    }
  },
}))
