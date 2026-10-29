import { create } from 'zustand'
import { measureMM } from '@/lib/utils'
import { linesPerPage, pageSize } from '@/lib/geometry'
import type { WritingMode } from '@/lib/geometry'
import type { PinyinMode } from '@/lib/words'
import type { Script } from '@/lib/script'
import { useProjectsStore } from './projects-store'

export interface DocumentActions {
  pageWidth: () => number
  pageHeight: () => number
  setDocumentAttribute: <K extends keyof DocumentState>(
    attrs: Pick<DocumentState, K>,
  ) => void
  setColumns: (columns: number) => void
  getSettings: () => DocumentState
  toggleDebug: () => void
  // lines (rows, or columns in vertical modes) that fit on a page
  linesPerPage: () => number
}

export interface DocumentState {
  fontSize: number
  pinyinSize: number
  pinyinOffset: number
  // pinyin turned off isn't drawn, but its room on the page is kept
  showPinyin: boolean
  // pinyin placement in horizontal modes
  pinyinPosition: 'top' | 'bottom'
  // pinyin placement in vertical modes
  pinyinSide: 'left' | 'right'
  // characters per line (per column in vertical modes)
  columns: number
  gapX: number
  gapY: number
  marginX: number
  marginY: number
  layout: 'portrait' | 'landscape'
  writingMode: WritingMode
  // characters are drawn in this script, whatever they were typed in
  script: Script
  // reading aids, which print the way they're shown
  // faint background behind words of more than one character
  wordGroups: boolean
  pinyinMode: PinyinMode
  // with pinyinMode 'unknown', words up to this HSK level have their pinyin
  // hidden
  hskLevel: number
}

export interface DocumentStore extends DocumentState, DocumentActions {
  debug: boolean
  mmX: number
  mmY: number
}

export const defaultDocumentState: () => DocumentState = () => ({
  fontSize: 10,
  pinyinSize: 4,
  pinyinOffset: 0,
  showPinyin: true,
  pinyinPosition: 'bottom',
  pinyinSide: 'right',
  columns: 22,
  gapX: 1.1,
  gapY: 2.2,
  marginX: 15,
  marginY: 15,
  layout: 'landscape',
  writingMode: 'horizontal-ltr',
  script: 'original',
  wordGroups: false,
  pinyinMode: 'unknown',
  hskLevel: 3,
})

export const useDocumentStore = create<DocumentStore>()((set, get) => ({
  ...defaultDocumentState(),
  debug: false,
  mmX: measureMM().mmX,
  mmY: measureMM().mmY,
  pageWidth: () => pageSize(get()).width,
  pageHeight: () => pageSize(get()).height,
  getSettings: () => {
    const state = get()
    return Object.fromEntries(
      Object.keys(defaultDocumentState()).map((key) => [
        key,
        state[key as keyof DocumentState],
      ]),
    ) as unknown as DocumentState
  },
  setDocumentAttribute: (attr) => {
    set(attr)
    const settings = get().getSettings()

    useProjectsStore
      .getState()
      .setActiveProjectAttribute({ doc: { ...settings, ...attr } })
  },
  setColumns: (columns: number) => {
    // the cursor and selection are stored as document positions, so they
    // stay valid when the layout changes
    get().setDocumentAttribute({ columns })
  },
  toggleDebug: () => set((state) => ({ debug: !state.debug })),
  linesPerPage: () => linesPerPage(get()),
}))
