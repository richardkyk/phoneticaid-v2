import { create } from 'zustand'
import { useCursorStore } from './cursor-store'
import {
  getGridCursorPosition,
  getPieceTableCursorPosition,
} from '../piece-table'
import { measureMM } from '@/lib/utils'
import { useProjectsStore } from './projects-store'

export interface RowsState {
  rows: number
  setRows: (rows: number) => void
}

export const useRowsStore = create<RowsState>((set) => ({
  rows: 1,
  setRows: (rows: number) => {
    set({ rows })
  },
}))

export interface DocumentActions {
  pageWidth: () => number
  pageHeight: () => number
  setDocumentAttribute: <K extends keyof DocumentState>(
    attrs: Pick<DocumentState, K>,
  ) => void
  setColumns: (columns: number) => void
  getSettings: () => DocumentState
  toggleDebug: () => void
  rowHeight: () => number
  rowsPerPage: () => number
}

export interface DocumentState {
  fontSize: number
  pinyinSize: number
  pinyinOffset: number
  pinyinPosition: 'top' | 'bottom'
  columns: number
  gapX: number
  gapY: number
  marginX: number
  marginY: number
  layout: 'portrait' | 'landscape'
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
  columns: 22,
  gapX: 1.1,
  gapY: 2.2,
  marginX: 15,
  marginY: 15,
  layout: 'landscape',
})

export const useDocumentStore = create<DocumentStore>()((set, get) => ({
  ...defaultDocumentState(),
  debug: false,
  mmX: measureMM().mmX,
  mmY: measureMM().mmY,
  pageWidth: () => (get().layout === 'portrait' ? 210 : 297),
  pageHeight: () => (get().layout === 'portrait' ? 297 : 210),
  getSettings: () => {
    const settings = {
      fontSize: get().fontSize,
      pinyinSize: get().pinyinSize,
      pinyinOffset: get().pinyinOffset,
      pinyinPosition: get().pinyinPosition,
      columns: get().columns,
      gapX: get().gapX,
      gapY: get().gapY,
      marginX: get().marginX,
      marginY: get().marginY,
      layout: get().layout,
    }
    return settings
  },
  setDocumentAttribute: (attr) => {
    set(attr)
    const settings = get().getSettings()

    useProjectsStore
      .getState()
      .setActiveProjectAttribute({ doc: { ...settings, ...attr } })
  },
  setColumns: (columns: number) => {
    const increasing = get().columns < columns
    const cursor = useCursorStore.getState()
    cursor.resetSelection()
    const settings = get().getSettings()

    if (cursor.offset <= 1 || increasing) {
      set({ columns })
      useProjectsStore
        .getState()
        .setActiveProjectAttribute({ doc: { ...settings, columns } })
      return
    }

    const { row, col, isNewLine } = getGridCursorPosition(
      cursor.pieceIndex,
      cursor.charIndex,
    )

    let newRow = row
    let newCol = col + cursor.offset

    if (isNewLine) {
      newRow += 1
      newCol = cursor.offset - (get().columns - columns)
    }

    if (newCol > columns) newCol = columns

    const newPos = getPieceTableCursorPosition(newRow, newCol)
    cursor.setCursorByPiece(newPos.pieceIndex, newPos.charIndex, newPos.offset)
    set({ columns })
    useProjectsStore
      .getState()
      .setActiveProjectAttribute({ doc: { ...settings, columns } })
  },
  toggleDebug: () => set((state) => ({ debug: !state.debug })),
  rowHeight: () =>
    get().fontSize + get().gapY + get().pinyinSize + get().pinyinOffset,
  rowsPerPage: () =>
    Math.floor((get().pageHeight() - get().marginY * 2) / get().rowHeight()),
}))
