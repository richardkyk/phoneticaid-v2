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

export const useDocumentStore = create<DocumentState>((set, get) => ({
  fontSize: 20,
  columns: 9,
  gapX: 0,
  gapY: 0,
  marginX: 15,
  marginY: 15,
  debug: true,

  setFontSize: (fontSize: number) => set({ fontSize }),
  setColumns: (columns: number) => {
    const increasing = get().columns < columns
    const cursor = useCursorStore.getState()
    cursor.resetSelection()
    if (cursor.offset <= 1 || increasing) {
      set({ columns })
      return
    }

    // if we are decreasing the columns, we may need to cap the column
    const { row, col, isNewLine } = getCursorPosition(
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

    const newPos = resolveCharPosition(newRow, newCol)
    cursor.setCursorByPiece(newPos.pieceIndex, newPos.charIndex, newPos.offset)
    set({ columns })
  },
  setGapX: (gapX: number) => set({ gapX }),
  setGapY: (gapY: number) => set({ gapY }),
  setMarginX: (marginX: number) => set({ marginX }),
  setMarginY: (marginY: number) => set({ marginY }),
}))
