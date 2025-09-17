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
    original: '\n',
    add: '你好世界',
    pieces: [
      { buffer: 'original', start: 0, length: 1 },
      { buffer: 'add', start: 0, length: 4 },
    ],
  },
  insertAtCursor: (text: string) => {
    const cursor = useCursorStore.getState()
    set((state) => {
      const pt = { ...state.pt, pieces: [...state.pt.pieces] }
      const newCursor = insertText(
        pt,
        cursor.pieceIndex,
        cursor.charIndex,
        cursor.offset,
        text,
      )
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
    if (cursor.pieceIndex <= 0 && cursor.charIndex === 0 && cursor.offset === 0)
      return
    if (cursor.offset > 1 || cursor.pieceIndex === -1) {
      // if pieceIndex is -1, it means we are at the start of the document so there's nothing to delete
      useCursorStore
        .getState()
        .setCursorByPiece(
          cursor.pieceIndex,
          cursor.charIndex,
          cursor.offset - 1,
        )
      return
    }
    set((state) => {
      const pt = { ...state.pt, pieces: [...state.pt.pieces] }
      const newCursor = deleteBackwards(
        pt,
        cursor.pieceIndex,
        cursor.charIndex,
        cursor.offset,
      )
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
