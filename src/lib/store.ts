import { create } from 'zustand'
import { Piece } from './render'

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

export interface ContentState {
  originalBuffer: string
  addBuffer: string
  rows: {
    pieces: Piece[]
  }[]

  appendAdd: (add: string) => void
  insertRow: (index?: number) => void
}

export const useContentStore = create<ContentState>((set, get) => ({
  originalBuffer: '你好世界',
  addBuffer: '我叫',
  rows: [
    {
      pieces: [{ type: 'original', start: 0, length: 4, col: 4 }],
    },
    {
      pieces: [
        { type: 'add', start: 0, length: 1, col: 2 },
        { type: 'add', start: 1, length: 1, col: 8 },
      ],
    },
  ],

  appendAdd: (val) => set({ addBuffer: val }),
  insertRow: (index) => {
    const cursor = useCursorStore.getState()
    const rowIdx = index || cursor.cursorRow
    const newRows = [...get().rows]
    const targetRow = newRows[rowIdx]

    const targetRowPieces = []
    const newRowPieces = []

    for (const piece of targetRow.pieces) {
      // contiguous piece remains in the same row
      if (piece.col + piece.length < cursor.cursorCol) {
        targetRowPieces.push(piece)
        continue
      }

      // contiguous piece moves to the next row
      if (piece.col > cursor.cursorCol) {
        const newPiece = {
          ...piece,
          col: piece.col - cursor.cursorCol,
        }
        newRowPieces.push(newPiece)
        continue
      }

      // need to split the piece
      const targetRowLength = cursor.cursorCol - piece.col
      const newRowLength = piece.length - targetRowLength
      targetRowPieces.push({
        ...piece,
        length: targetRowLength,
      })
      newRowPieces.push({
        ...piece,
        start: piece.start + targetRowLength,
        length: newRowLength,
        col: 0,
      })
    }

    targetRow.pieces = targetRowPieces

    newRows.splice(rowIdx + 1, 0, {
      pieces: newRowPieces,
    })
    set({ rows: newRows })
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
    const content = useContentStore.getState()
    const { cursorRow, cursorCol } = get()
    let newCursorRow,
      newCursorCol = 0
    switch (key) {
      case 'ArrowUp':
        newCursorRow = cursorRow - 1
        if (newCursorRow < 0) return
        get().updateCursor(newCursorRow, cursorCol)
        break
      case 'ArrowDown':
        newCursorRow = cursorRow + 1
        if (newCursorRow >= content.rows.length) return
        get().updateCursor(newCursorRow, cursorCol)
        break
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
