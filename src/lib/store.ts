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

  setFontSize: (fontSize: number) => void
  setColumns: (columns: number) => void
  setGapX: (gapX: number) => void
  setGapY: (gapY: number) => void
  setMarginX: (marginX: number) => void
  setMarginY: (marginY: number) => void
}

export const useDocumentStore = create<DocumentState>((set) => ({
  fontSize: 10,
  columns: 17,
  gapX: 0,
  gapY: 0,
  marginX: 20,
  marginY: 20,

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
  insertRange: (substr: string) => void
  deleteRange: (length: number) => void
}

export const usePieceTableStore = create<PieceTableState>((set) => ({
  pt: {
    original: '    你\n好 世界',
    add: '\n我是',
    pieces: [
      { buffer: 'original', start: 0, length: 10 },
      { buffer: 'add', start: 0, length: 3 },
    ],
  },
  insertRange: (text: string) => {
    const cursor = useCursorStore.getState()
    const document = useDocumentStore.getState()
    set((state) => {
      const pt = { ...state.pt, pieces: [...state.pt.pieces] }
      insertAtRowCol(pt, cursor.cursorRow, cursor.cursorCol, text, document)
      return { pt }
    })
  },
  deleteRange: (length: number) => {
    const cursor = useCursorStore.getState()
    const document = useDocumentStore.getState()
    set((state) => {
      const pt = { ...state.pt, pieces: [...state.pt.pieces] }
      deleteBackwardsFromRowCol(
        pt,
        cursor.cursorRow,
        cursor.cursorCol,
        length,
        document,
      )
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
