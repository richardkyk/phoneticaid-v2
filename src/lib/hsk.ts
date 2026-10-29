import { create } from 'zustand'

// HSK word lists, built into public/hsk by scripts/build-hsk.mjs and fetched
// the first time they're needed (the browser caches them after that)

export type HskVersion = '3.0' | '2.0'

export const hskVersions: Array<{
  value: HskVersion
  label: string
  maxLevel: number
}> = [
  // the last HSK 3.0 level covers levels 7-9
  { value: '3.0', label: 'HSK 3.0', maxLevel: 7 },
  { value: '2.0', label: 'HSK 2.0', maxLevel: 6 },
]

export const hskMaxLevel = (version: HskVersion) =>
  hskVersions.find((v) => v.value === version)?.maxLevel ?? 6

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
  levels: Partial<Record<HskVersion, HskLevels>>
  load: (version: HskVersion) => void
}

const loading = new Set<HskVersion>()

export const useHskStore = create<HskState>()((set, get) => ({
  levels: {},
  load: async (version) => {
    if (get().levels[version] || loading.has(version)) return
    loading.add(version)
    try {
      const res = await fetch(`/hsk/hsk-${version}.txt`)
      if (!res.ok) throw new Error(`HSK ${version} list: ${res.status}`)
      const levels = parseHskLevels(await res.text())
      set({ levels: { ...get().levels, [version]: levels } })
    } catch (err) {
      console.error(err)
    } finally {
      loading.delete(version)
    }
  },
}))
