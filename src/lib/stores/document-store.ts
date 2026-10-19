import { create } from 'zustand'
import { measureMM } from '@/lib/utils'
import { linesPerPage, pageSize } from '@/lib/geometry'
import type { WritingMode } from '@/lib/geometry'
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
  pinyinPosition: 'bottom',
  pinyinSide: 'right',
  columns: 22,
  gapX: 1.1,
  gapY: 2.2,
  marginX: 15,
  marginY: 15,
  layout: 'landscape',
  writingMode: 'horizontal-ltr',
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
