import { create } from 'zustand'
import {
  deleteBackwards,
  deleteSelection,
  getText,
  insertText,
  PieceTable,
  resolveCharPosition,
} from './piece-table'
import { PieceTablePosition, useCursorStore } from './cursor-store'

export interface PieceTableState {
  pt: PieceTable
  extractSelection: () => string
  deleteSelection: () => void
  insertAtCursor: (substr: string) => void
  deleteAtCursor: (length: number) => void
}

export const usePieceTableStore = create<PieceTableState>((set, get) => ({
  pt: {
    original: 'hello\n',
    add: '    nihao',
    pieces: [
      {
        buffer: 'original',
        start: 0,
        length: 6,
      },
      {
        buffer: 'add',
        start: 0,
        length: 9,
      },
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
  deleteSelection: () => {
    const selection = useCursorStore.getState().getSelection()
    const cursor = useCursorStore.getState()
    if (!selection) return

    const ptStart = resolveCharPosition(
      selection.start.row,
      selection.start.col,
    )
    const ptEnd = resolveCharPosition(selection.end.row, selection.end.col)

    if (ptStart.pieceIndex === ptEnd.pieceIndex) {
      if (ptStart.pieceIndex === -1) {
        cursor.resetSelection()
        return
      }

      if (
        ptStart.charIndex === ptEnd.charIndex &&
        ptStart.offset > 0 &&
        ptEnd.offset > 0
      ) {
        // the selection only contains padding since they reference the same piece
        cursor.resetSelection()
        return
      }
    }

    let deleteStart = {
      pieceIndex: ptStart.pieceIndex,
      charIndex: ptStart.charIndex + (ptStart.offset > 0 ? 1 : 0),
    }

    if (ptStart.pieceIndex === -1) {
      // special case where the selection starts in padding (i.e. its reference piece is -1)
      // so we need to reference the piece at pieceIndex 0 and charIndex 0 so that it can be deleted
      deleteStart.pieceIndex = 0
      deleteStart.charIndex = ptStart.charIndex
    }

    const deleteEnd = {
      pieceIndex: ptEnd.pieceIndex,
      charIndex: ptEnd.charIndex + (ptEnd.offset > 0 ? 1 : 0),
    }
    cursor.resetSelection()
    deleteSelection(get().pt, deleteStart, deleteEnd)
  },
  insertAtCursor: (text: string) => {
    const _cursor = useCursorStore.getState()
    let cursor: PieceTablePosition = {
      ..._cursor,
    }

    const selection = useCursorStore.getState().getSelection()
    if (selection) {
      get().deleteSelection()
      cursor = resolveCharPosition(selection.start.row, selection.start.col)
    }

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
