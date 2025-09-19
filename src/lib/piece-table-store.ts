import { create } from 'zustand'
import {
  deleteBackwards,
  getText,
  insertText,
  PieceTable,
  resolveCharPosition,
} from './piece-table'
import { useCursorStore } from './cursor-store'

export interface PieceTableState {
  pt: PieceTable
  extractSelection: () => string
  insertAtCursor: (substr: string) => void
  deleteAtCursor: (length: number) => void
}

export const usePieceTableStore = create<PieceTableState>((set, get) => ({
  pt: {
    original: '\n',
    add: '你好世界',
    pieces: [
      { buffer: 'original', start: 0, length: 1 },
      { buffer: 'add', start: 0, length: 4 },
    ],
  },
  extractSelection: () => {
    const cursor = useCursorStore.getState()
    if (!cursor.selectionStart || !cursor.selectionEnd) return ''

    const _start = resolveCharPosition(
      cursor.selectionStart.row,
      cursor.selectionStart.col,
    )
    const _end = resolveCharPosition(
      cursor.selectionEnd.row,
      cursor.selectionEnd.col,
    )

    const start = {
      pieceIndex: _start.pieceIndex < 0 ? 0 : _start.pieceIndex,
      charIndex: _start.pieceIndex < 0 ? 0 : _start.charIndex + _start.offset,
    }
    const end = {
      pieceIndex: _end.pieceIndex < 0 ? 0 : _end.pieceIndex,
      charIndex: _end.pieceIndex < 0 ? 0 : _end.charIndex + _end.offset,
    }
    return getText(get().pt, start, end)
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
