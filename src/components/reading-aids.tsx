import { useEffect } from 'react'
import { Fragment } from 'react/jsx-runtime'
import type { Cell } from '@/lib/layout'
import type { DocumentStore } from '@/lib/stores/document-store'
import { useCursorStore } from '@/lib/stores/cursor-store'
import { useRevealStore } from '@/lib/stores/reveal-store'
import { useLexiconStore } from '@/lib/hsk'
import type { HskLevels } from '@/lib/hsk'
import { wordRect } from '@/lib/geometry'
import { hiddenPinyin } from '@/lib/words'
import type { PinyinMode, TextAnalysis } from '@/lib/words'
import { Pinyin, rectStyle } from './grid'

let hiddenCache: {
  args: [TextAnalysis, PinyinMode, HskLevels | undefined, number]
  hidden: Uint8Array | null
} | null = null

// Which characters have their pinyin hidden. Shared by every page, so it's
// only worked out once per change.
export function useHiddenPinyin(
  document: DocumentStore,
  analysis: TextAnalysis,
) {
  const { pinyinMode, hskLevel } = document
  const levels = useLexiconStore((state) => state.lexicon?.levels)

  const args: [TextAnalysis, PinyinMode, HskLevels | undefined, number] = [
    analysis,
    pinyinMode,
    levels,
    hskLevel,
  ]
  if (!hiddenCache || hiddenCache.args.some((arg, i) => arg !== args[i])) {
    hiddenCache = { args, hidden: hiddenPinyin(...args) }
  }
  return hiddenCache.hidden
}

// Shows all hidden pinyin while Alt (Option) is held
export function usePeekKey() {
  useEffect(() => {
    const { setPeeking } = useRevealStore.getState()
    const handleKey = (e: KeyboardEvent) => setPeeking(e.altKey)
    const stopPeeking = () => setPeeking(false)
    window.addEventListener('keydown', handleKey)
    window.addEventListener('keyup', handleKey)
    window.addEventListener('blur', stopPeeking)
    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('keyup', handleKey)
      window.removeEventListener('blur', stopPeeking)
    }
  }, [])
}

// The character under the pointer, for revealing its word's pinyin
export const trackHover = (e: React.PointerEvent) => {
  // a finger reveals its word when it taps (see editor.tsx), as pressing is
  // also how it starts selecting
  if (e.pointerType === 'touch') return
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-index]')
  const index = el ? Number(el.dataset.index) : -1
  useRevealStore
    .getState()
    .setHovered(index >= 0 ? index : null, el?.dataset.pinyin !== undefined)
}
export const clearHover = (e: React.PointerEvent) => {
  // taps keep their word revealed
  if (e.pointerType !== 'mouse') return
  useRevealStore.getState().setHovered(null)
}

// Runs of cells on a row that belong to the same word
function wordRuns(row: Array<Cell>, analysis: TextAnalysis) {
  const runs: Array<{ word: number; startCol: number; endCol: number }> = []
  for (const cell of row) {
    const word = cell.index === -1 ? -1 : analysis.wordAt[cell.index]
    if (word === -1) continue
    const last = runs.at(-1)
    if (last && last.word === word && last.endCol === cell.col - 1) {
      last.endCol = cell.col
    } else {
      runs.push({ word, startCol: cell.col, endCol: cell.col })
    }
  }
  return runs
}

interface WordGroupsProps {
  document: DocumentStore
  pageRows: Array<Array<Cell>>
  analysis: TextAnalysis
  hidden: Uint8Array | null
}
// A faint background behind each word of more than one character, except
// words whose pinyin is hidden, which are left to be read unaided
export const WordGroups = (props: WordGroupsProps) => {
  const { document, analysis, hidden } = props
  // only words showing their pinyin are grouped
  if (!document.wordGroups || !document.showPinyin) return null

  return (
    <Fragment>
      {props.pageRows.map((row, i) =>
        wordRuns(row, analysis)
          .filter(({ word }) => {
            const { start, end } = analysis.words[word]
            return end - start > 1 && !hidden?.[start]
          })
          .map(({ startCol, endCol }) => (
            <div
              key={`${i}-${startCol}`}
              className="absolute rounded-sm bg-sky-100/70 pointer-events-none [print-color-adjust:exact]"
              style={rectStyle(
                wordRect(document, i, startCol, endCol),
                document,
              )}
            />
          )),
      )}
    </Fragment>
  )
}

interface RevealedPinyinProps {
  document: DocumentStore
  pageRows: Array<Array<Cell>>
  analysis: TextAnalysis
  hidden: Uint8Array | null
}
// Hidden pinyin that's being looked at: the hovered (or tapped) word, the
// selection, or everything while the peek key is held. Never printed.
export const RevealedPinyin = (props: RevealedPinyinProps) => {
  const { document, analysis, hidden } = props
  const hovered = useRevealStore((state) => state.hovered)
  const peeking = useRevealStore((state) => state.peeking)
  const selectionStart = useCursorStore((state) => state.selectionStart)
  const selectionEnd = useCursorStore((state) => state.selectionEnd)

  if (!hidden || !document.showPinyin) return null

  const ranges: Array<[number, number]> = []
  if (hovered !== null) {
    const word = analysis.words[analysis.wordAt[hovered]]
    ranges.push(word ? [word.start, word.end] : [hovered, hovered + 1])
  }
  if (selectionStart && selectionEnd) {
    const a = selectionStart.index
    const b = selectionEnd.index
    ranges.push([Math.min(a, b), Math.max(a, b)])
  }
  if (!peeking && ranges.length === 0) return null

  const revealed = (index: number) =>
    peeking || ranges.some(([start, end]) => index >= start && index < end)

  return (
    <div className="print:hidden pointer-events-none">
      {props.pageRows.map((row, i) =>
        row.map((cell) => {
          if (cell.index === -1 || !hidden[cell.index]) return null
          if (!revealed(cell.index)) return null
          const pinyin = analysis.pinyin[cell.index]
          if (!pinyin) return null
          return (
            <Pinyin
              key={`${i}-${cell.col}`}
              document={document}
              line={i}
              col={cell.col}
              index={cell.index}
              className="text-sky-700"
            >
              {pinyin}
            </Pinyin>
          )
        }),
      )}
    </div>
  )
}
