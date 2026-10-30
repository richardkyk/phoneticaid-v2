import { create } from 'zustand'

// English meanings of words from CC-CEDICT, for the dictionary card. Built
// into public/dict/meanings by scripts/build-cedict.mjs, split by the first
// character so a card only fetches a small part of it.

export interface Reading {
  // one syllable per character, e.g. dōng xi
  pinyin: string
  meanings: Array<string>
}

export type Dictionary = Map<string, Array<Reading>>

// must match SHARDS in scripts/build-cedict.mjs
const SHARDS = 64

// which part of the dictionary has a word
export const shardOf = (word: string) => (word.codePointAt(0) ?? 0) % SHARDS

// How CC-CEDICT writes a word: it only has 泄露 and the like with 泄, even
// in traditional
export const dictionaryForm = (word: string) => word.replaceAll('洩', '泄')

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

// The readings of a word, the one it has in the text (`pinyin`, one syllable
// per character, e.g. 还 hái rather than huán) first
export function lookUp(
  dictionary: Dictionary,
  word: string,
  pinyin: string,
): Array<Reading> {
  const readings = dictionary.get(word) ?? []
  const rank = (reading: Reading) =>
    reading.pinyin === pinyin
      ? 0
      : plainPinyin(reading.pinyin) === plainPinyin(pinyin)
        ? 1
        : 2
  return [...readings].sort((a, b) => rank(a) - rank(b))
}

// pinyin without its tones, as 一 and 不 are written as they're said in the
// text (see words.ts)
export const plainPinyin = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

export interface ReadingOption {
  // one per character
  syllables: Array<string>
  // e.g. "also said" for 泄露 xiè lù, beside its usual xiè lòu
  note?: string
}

// The ways a word can be read: its readings, then the other pronunciations
// their meanings mention (also pr. xiè lù, Taiwan pr. jí)
export function readingOptions(
  readings: Array<Reading>,
  length: number,
): Array<ReadingOption> {
  const options: Array<ReadingOption> = []
  const add = (pinyin: string, note?: string) => {
    const syllables = pinyin.split(' ')
    if (
      syllables.length === length &&
      syllables.every((s) => /^\p{L}+$/u.test(s)) &&
      !options.some((o) => o.syllables.join(' ') === pinyin)
    ) {
      options.push({ syllables, note })
    }
  }
  for (const reading of readings) add(reading.pinyin)
  for (const reading of readings) {
    for (const meaning of reading.meanings) {
      for (const match of meaning.matchAll(
        /\b(also|Taiwan) pr\. (\p{L}+(?: \p{L}+)*)/gu,
      )) {
        // the words after the pinyin aren't part of it
        const pinyin = match[2].split(' ').slice(0, length).join(' ')
        add(pinyin, match[1] === 'also' ? 'also said' : 'in Taiwan')
      }
    }
  }
  return options
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
