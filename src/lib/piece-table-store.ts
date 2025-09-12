import { create } from 'zustand'
import { deleteBackwards, insertText, PieceTable } from './piece-table'
import { useCursorStore } from './cursor-store'

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
    if (cursor.offset > 1) {
      useCursorStore
        .getState()
        .setCursorByPiece(
          cursor.pieceIndex,
          cursor.charIndex,
          cursor.offset - 1,
        )
      return
    }
    if (
      cursor.pieceIndex === 0 &&
      cursor.charIndex === 0 &&
      cursor.offset === 0
    )
      return
    set((state) => {
      const pt = { ...state.pt, pieces: [...state.pt.pieces] }
      const newCursor = deleteBackwards(
        pt,
        cursor.pieceIndex,
        cursor.charIndex,
        cursor.offset,
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
}))
