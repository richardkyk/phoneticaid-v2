import { create } from 'zustand'
import { deleteBackwards, insertText, PieceTable } from './piece-table'
import { useCursorStore } from './cursor-store'
import { useDocumentStore } from './document-store'

export interface PieceTableState {
  pt: PieceTable
  insertAtCursor: (substr: string) => void
  deleteAtCursor: (length: number) => void
}

export const usePieceTableStore = create<PieceTableState>((set) => ({
  pt: {
    original: 'hello\n',
    add: 'world!',
    pieces: [
      { buffer: 'original', start: 0, length: 6 },
      { buffer: 'add', start: 0, length: 5 },
      { buffer: 'add', start: 5, length: 1 },
    ],
  },
  insertAtCursor: (text: string) => {
    const cursor = useCursorStore.getState()
    console.log('insert', cursor)
    set((state) => {
      const pt = { ...state.pt, pieces: [...state.pt.pieces] }
      const newCursor = insertText(
        pt,
        cursor.pieceIndex,
        cursor.charIndex,
        cursor.offset,
        text,
      )
      console.log('newCursor', newCursor)
      useCursorStore
        .getState()
        .setCursorByPiece(
          newCursor.pieceIndex,
          newCursor.charIndex,
          newCursor.offset,
        )
      return { pt }
    })
  },
  deleteAtCursor: () => {
    const cursor = useCursorStore.getState()
    const document = useDocumentStore.getState()
    set((state) => {
      const pt = { ...state.pt, pieces: [...state.pt.pieces] }
      // deleteBackwards(pt, cursor.row, cursor.col, document)
      return { pt }
    })
  },
}))
