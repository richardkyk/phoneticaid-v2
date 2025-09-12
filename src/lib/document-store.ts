import { create } from 'zustand'
import { useCursorStore } from './cursor-store'
import { getCursorPosition, resolveCharPosition } from './piece-table'

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
  fontSize: number
  columns: number
  gapX: number
  gapY: number
  marginX: number
  marginY: number
  debug: boolean

  setFontSize: (fontSize: number) => void
  setColumns: (columns: number) => void
  setGapX: (gapX: number) => void
  setGapY: (gapY: number) => void
  setMarginX: (marginX: number) => void
  setMarginY: (marginY: number) => void
}

export const useDocumentStore = create<DocumentState>((set) => ({
  fontSize: 20,
  columns: 9,
  gapX: 0,
  gapY: 0,
  marginX: 15,
  marginY: 15,
  debug: true,

  setFontSize: (fontSize: number) => set({ fontSize }),
  setColumns: (columns: number) => {
    set({ columns })
    const cursor = useCursorStore.getState()
    if (cursor.offset <= 1) return

    let { row, col } = getCursorPosition(cursor.pieceIndex, cursor.charIndex)
    col += cursor.offset

    if (col > columns) {
      col = columns
    }

    const newPos = resolveCharPosition(row, col, true)
    cursor.setCursorByPiece(newPos.pieceIndex, newPos.charIndex, newPos.offset)
  },
  setGapX: (gapX: number) => set({ gapX }),
  setGapY: (gapY: number) => set({ gapY }),
  setMarginX: (marginX: number) => set({ marginX }),
  setMarginY: (marginY: number) => set({ marginY }),
}))
