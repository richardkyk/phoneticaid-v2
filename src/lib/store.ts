import { create } from 'zustand'
import {
  deleteBackwardsFromRowCol,
  insertAtRowCol,
  PieceTable,
} from './piece-table'

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

  setFontSize: (fontSize: number) => {
    set({ fontSize })
    const cursor = useCursorStore.getState()
    cursor.updateCursor(cursor.cursorRow, cursor.cursorCol)
  },
  setColumns: (columns: number) => {
    set({ columns })
    const cursor = useCursorStore.getState()
    const newCursorCol = cursor.cursorCol > columns ? columns : cursor.cursorCol
    cursor.updateCursor(cursor.cursorRow, newCursorCol)
  },
  setGapX: (gapX: number) => {
    set({ gapX })
    const cursor = useCursorStore.getState()
    cursor.updateCursor(cursor.cursorRow, cursor.cursorCol)
  },
  setGapY: (gapY: number) => {
    set({ gapY })
    const cursor = useCursorStore.getState()
    cursor.updateCursor(cursor.cursorRow, cursor.cursorCol)
  },
  setMarginX: (marginX: number) => {
    set({ marginX })
    const cursor = useCursorStore.getState()
    cursor.updateCursor(cursor.cursorRow, cursor.cursorCol)
  },
  setMarginY: (marginY: number) => {
    set({ marginY })
    const cursor = useCursorStore.getState()
    cursor.updateCursor(cursor.cursorRow, cursor.cursorCol)
  },
}))

export interface PieceTableState {
  pt: PieceTable
  insertAtCursor: (substr: string) => void
  deleteAtCursor: (length: number) => void
}

export const usePieceTableStore = create<PieceTableState>((set) => ({
  pt: {
    original: 'abc\ndef',
    add: '123',
    pieces: [
      { buffer: 'original', start: 0, length: 7 },
      { buffer: 'add', start: 0, length: 3 },
    ],
  },
  insertAtCursor: (text: string) => {
    const cursor = useCursorStore.getState()
    const document = useDocumentStore.getState()
    set((state) => {
      const pt = { ...state.pt, pieces: [...state.pt.pieces] }
      const newPos = insertAtRowCol(
        pt,
        cursor.cursorRow,
        cursor.cursorCol,
        text,
        document,
      )
      console.log(newPos)
      if (newPos) cursor.updateCursor(newPos.curRow, newPos.curCol + 1)
      return { pt }
    })
  },
  deleteAtCursor: (length: number) => {
    const cursor = useCursorStore.getState()
    const document = useDocumentStore.getState()
    set((state) => {
      const pt = { ...state.pt, pieces: [...state.pt.pieces] }
      const newPos = deleteBackwardsFromRowCol(
        pt,
        cursor.cursorRow,
        cursor.cursorCol,
        length,
        document,
      )
      console.log(newPos)
      if (newPos) {
        cursor.updateCursor(newPos.curRow, newPos.curCol)
      } else {
        if (cursor.cursorRow === 0 && cursor.cursorCol === 0) return { pt }

        const newCursorCol =
          cursor.cursorCol > 0 ? cursor.cursorCol - 1 : document.columns
        const newCursorRow = cursor.cursorCol === 0 ? cursor.cursorRow - 1 : 0
        cursor.updateCursor(newCursorRow, newCursorCol)
      }
      return { pt }
    })
  },
}))

interface CursorState {
  cursorX: number
  cursorY: number
  cursorRow: number
  cursorCol: number
  cursorVisible: boolean

  moveCursor: (key: string) => void
  updateCursor: (row: number, col: number) => void
}

export const useCursorStore = create<CursorState>((set, get) => ({
  cursorX: 0,
  cursorY: 0,
  cursorRow: 0,
  cursorCol: 0,
  cursorVisible: false,

  moveCursor: (key: string) => {
    const document = useDocumentStore.getState()
    // const content = useContentStore.getState()
    const { cursorRow, cursorCol } = get()
    let newCursorRow,
      newCursorCol = 0
    switch (key) {
      case 'ArrowUp':
        newCursorRow = cursorRow - 1
        if (newCursorRow < 0) return
        get().updateCursor(newCursorRow, cursorCol)
        break
      // case 'ArrowDown':
      //   newCursorRow = cursorRow + 1
      //   if (newCursorRow >= content.rows.length) return
      //   get().updateCursor(newCursorRow, cursorCol)
      //   break
      case 'ArrowLeft':
        newCursorCol = cursorCol - 1
        if (newCursorCol < 0) return
        get().updateCursor(cursorRow, newCursorCol)
        break
      case 'ArrowRight':
        newCursorCol = cursorCol + 1
        if (newCursorCol > document.columns) return // allow to go beyond the last column so that we can 'delete' the last character
        get().updateCursor(cursorRow, newCursorCol)
        break
    }
  },
  updateCursor: (cursorRow: number, cursorCol: number) => {
    const document = useDocumentStore.getState()
    const cursorX =
      document.marginX + cursorCol * (document.gapX + document.fontSize)
    const cursorY =
      document.marginY + cursorRow * (document.gapY + document.fontSize)
    set({ cursorRow, cursorCol, cursorX, cursorY, cursorVisible: true })
  },
}))
