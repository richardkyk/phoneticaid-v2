import { create } from 'zustand'
import { getText } from './piece-table'
import type { PieceTable } from './piece-table'

// Shows the text in simplified or traditional characters, whichever it was
// typed in. Only what's drawn changes, the document keeps the text as typed.
// Conversion uses OpenCC's phrase dictionaries (e.g. 头发 -> 頭髮, not 頭發),
// which are loaded the first time they're needed. The dictionary for
// traditional is large (~450 KB gzipped).

export type Script = 'original' | 'simplified' | 'traditional'

export const scripts: Array<{ value: Script; label: string }> = [
  { value: 'original', label: 'As typed' },
  { value: 'simplified', label: 'Simplified' },
  { value: 'traditional', label: 'Traditional' },
]

type Converter = (text: string) => string

interface ScriptState {
  converters: Partial<Record<Script, Converter>>
  load: (script: Script) => void
}

const loading = new Set<Script>()

export const useScriptStore = create<ScriptState>()((set, get) => ({
  converters: {},
  load: async (script) => {
    if (script === 'original') return
    if (get().converters[script] || loading.has(script)) return
    loading.add(script)
    try {
      // Taiwan standard characters, the usual traditional for learners
      const converter =
        script === 'traditional'
          ? (await import('opencc-js/cn2t')).Converter({ from: 'cn', to: 'tw' })
          : (await import('opencc-js/t2cn')).Converter({ from: 'tw', to: 'cn' })
      set({ converters: { ...get().converters, [script]: converter } })
    } catch (err) {
      console.error(err)
    } finally {
      loading.delete(script)
    }
  },
}))

// Converts per paragraph so edits only redo the paragraph they're in.
// Characters must stay in the same cells, so a paragraph whose length would
// change (OpenCC's standard conversions don't do this) is left as typed.
export function convertText(text: string, convert: Converter) {
  return text
    .split('\n')
    .map((paragraph) => {
      const converted = convert(paragraph)
      return converted.length === paragraph.length ? converted : paragraph
    })
    .join('\n')
}

const paragraphCache = new Map<Converter, Map<string, string>>()
const MAX_CACHED_PARAGRAPHS = 2000

const cachedConverter = (convert: Converter): Converter => {
  let cache = paragraphCache.get(convert)
  if (!cache) paragraphCache.set(convert, (cache = new Map()))
  return (paragraph) => {
    let converted = cache.get(paragraph)
    if (converted === undefined) {
      if (cache.size >= MAX_CACHED_PARAGRAPHS) cache.clear()
      converted = convert(paragraph)
      cache.set(paragraph, converted)
    }
    return converted
  }
}

let cache: {
  pt: PieceTable
  convert: Converter
  text: string
} | null = null

// The text as it's drawn, or null to draw it as typed (also while the
// converter is loading). Memoised by piece table identity, like getLayout.
export function getDisplayText(pt: PieceTable, script: Script): string | null {
  if (script === 'original') return null
  const convert = useScriptStore.getState().converters[script]
  if (!convert) return null
  if (cache?.pt === pt && cache.convert === convert) return cache.text
  const text = convertText(getText(pt), cachedConverter(convert))
  cache = { pt, convert, text }
  return text
}

// Text taken from the document (e.g. copied), in the script it's drawn in
export function toDisplayScript(text: string, script: Script) {
  if (script === 'original') return text
  const convert = useScriptStore.getState().converters[script]
  return convert ? convertText(text, convert) : text
}
