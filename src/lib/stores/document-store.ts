import { create } from 'zustand'
import { useCursorStore } from './cursor-store'
import {
  getGridCursorPosition,
  getPieceTableCursorPosition,
} from '../piece-table'
import { measureMM } from '@/lib/utils'
import { useTranslateStore } from './translate-store'

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

export interface DocumentState {
  pageWidth: () => number
  pageHeight: () => number
  fontSize: number
  pinyinSize: number
  pinyinOffset: number
  pinyinPosition: 'top' | 'bottom'
  columns: number
  gapX: number
  gapY: number
  marginX: number
  marginY: number
  mmX: number
  mmY: number
  debug: boolean
  layout: 'portrait' | 'landscape'
  translate: boolean

  setFontSize: (fontSize: number) => void
  setColumns: (columns: number) => void
  setPinyinSize: (pinyinSize: number) => void
  setPinyinOffset: (pinyinOffset: number) => void
  setPinyinPosition: (pinyinPosition: 'top' | 'bottom') => void
  setGapX: (gapX: number) => void
  setGapY: (gapY: number) => void
  setMarginX: (marginX: number) => void
  setMarginY: (marginY: number) => void
  toggleDebug: () => void
  toggleTranslate: () => void
  setMmX: (mmX: number) => void
  setMmY: (mmY: number) => void
  setLayout: (layout: 'portrait' | 'landscape') => void
  rowHeight: () => number
  rowsPerPage: () => number
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  pageWidth: () => (get().layout === 'portrait' ? 210 : 297),
  pageHeight: () => (get().layout === 'portrait' ? 297 : 210),
  fontSize: 10,
  pinyinSize: 4,
  pinyinOffset: 0,
  pinyinPosition: 'bottom',
  columns: 22,
  gapX: 1.1,
  gapY: 2.2,
  marginX: 15,
  marginY: 15,
  mmX: measureMM().mmX,
  mmY: measureMM().mmY,
  debug: false,
  layout: 'landscape',
  translate: true,

  setFontSize: (fontSize: number) => set({ fontSize }),
  setPinyinSize: (pinyinSize: number) => set({ pinyinSize }),
  setPinyinOffset: (pinyinOffset: number) => set({ pinyinOffset }),
  setPinyinPosition: (pinyinPosition: 'top' | 'bottom') =>
    set({ pinyinPosition }),
  setColumns: (columns: number) => {
    const increasing = get().columns < columns
    const cursor = useCursorStore.getState()
    cursor.resetSelection()
    if (cursor.offset <= 1 || increasing) {
      set({ columns })
      return
    }

    // if we are decreasing the columns, we may need to cap the column
    const { row, col, isNewLine } = getGridCursorPosition(
      cursor.pieceIndex,
      cursor.charIndex,
    )

    let newRow = row
    let newCol = col + cursor.offset

    if (isNewLine) {
      newRow += 1
      // we need to readjust the column since it will be calculating against the old column value
      // ie. the column count will decrease, but the offset will remain the same, this results with the cursor drifitng to the right
      newCol = cursor.offset - (get().columns - columns)
    }

    if (newCol > columns) {
      newCol = columns
    }

    const newPos = getPieceTableCursorPosition(newRow, newCol)
    cursor.setCursorByPiece(newPos.pieceIndex, newPos.charIndex, newPos.offset)
    set({ columns })
  },
  setGapX: (gapX: number) => set({ gapX }),
  setGapY: (gapY: number) => set({ gapY }),
  setMarginX: (marginX: number) => set({ marginX }),
  setMarginY: (marginY: number) => set({ marginY }),
  toggleDebug: () => set((state) => ({ debug: !state.debug })),
  toggleTranslate: () => {
    const isCurrentlyOn = get().translate
    set((state) => ({ translate: !state.translate }))
    if (isCurrentlyOn) return
    useTranslateStore.getState().translateSelection()
  },
  setMmX: (mmX: number) => set({ mmX }),
  setMmY: (mmY: number) => set({ mmY }),
  setLayout: (layout: 'portrait' | 'landscape') => set({ layout }),
  rowHeight: () =>
    get().fontSize + get().gapY + get().pinyinSize + get().pinyinOffset,
  rowsPerPage: () =>
    Math.floor((get().pageHeight() - get().marginY * 2) / get().rowHeight()),
}))
