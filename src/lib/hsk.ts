import { create } from 'zustand'

// The HSK 3.0 word list, built into public/hsk by scripts/build-hsk.mjs and
// fetched the first time it's needed (the browser caches it after that).
// Levels 7-9 are combined into level 7.

// word -> the lowest level it appears in
export type HskLevels = Map<string, number>

// one line per level, words separated by spaces
export function parseHskLevels(text: string): HskLevels {
  const levels: HskLevels = new Map()
  text.split('\n').forEach((line, i) => {
    for (const word of line.split(' ')) {
      if (word) levels.set(word, i + 1)
    }
  })
  return levels
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

interface HskState {
  levels: HskLevels | undefined
  load: () => void
}

let loading = false

export const useHskStore = create<HskState>()((set, get) => ({
  levels: undefined,
  load: async () => {
    if (get().levels || loading) return
    loading = true
    try {
      const res = await fetch('/hsk/hsk-3.0.txt')
      if (!res.ok) throw new Error(`HSK word list: ${res.status}`)
      set({ levels: parseHskLevels(await res.text()) })
    } catch (err) {
      console.error(err)
    } finally {
      loading = false
    }
  },
}))
