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
    const cursor = { ...useCursorStore.getState() }
    console.log('insert', cursor)
    set((state) => {
      const pt = { ...state.pt, pieces: [...state.pt.pieces] }
      if (cursor.isNewLine) {
        cursor.charIndex--
        if (cursor.charIndex < 0) {
          cursor.pieceIndex--
          if (cursor.pieceIndex < 0) return { pt }
          const piece = pt.pieces[cursor.pieceIndex]
          cursor.charIndex = piece.length - 1
        }
      }
      const newCursor = insertText({
        pt,
        pieceIndex: cursor.pieceIndex,
        charIndex: cursor.charIndex,
        offset: cursor.offset,
        text,
      })
      console.log('newCursor', newCursor)
      useCursorStore
        .getState()
        .setCursorByPiece(
          newCursor.pieceIndex,
          newCursor.charIndex,
          false,
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
