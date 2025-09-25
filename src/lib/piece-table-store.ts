import { create } from 'zustand'
import {
  deleteBackwards,
  deleteSelection,
  getText,
  insertText,
  PieceTable,
  getPieceTableCursorPosition,
} from './piece-table'
import { PieceTableCursor, useCursorStore } from './cursor-store'

export interface PieceTableState {
  pt: PieceTable
  extractSelection: () => string
  deleteSelection: () => PieceTableCursor | null
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
    const selection = useCursorStore.getState().getSelection()
    if (!selection) return ''

    const ptStart = getPieceTableCursorPosition(
      selection.start.row,
      selection.start.col,
    )
    const ptEnd = getPieceTableCursorPosition(
      selection.end.row,
      selection.end.col,
    )

    const extractStart = {
      pieceIndex: ptStart.pieceIndex < 0 ? 0 : ptStart.pieceIndex,
      charIndex:
        ptStart.pieceIndex < 0 ? 0 : ptStart.charIndex + ptStart.offset,
    }
    const extractEnd = {
      pieceIndex: ptEnd.pieceIndex < 0 ? 0 : ptEnd.pieceIndex,
      charIndex: ptEnd.pieceIndex < 0 ? 0 : ptEnd.charIndex + ptEnd.offset,
    }
    return getText(get().pt, extractStart, extractEnd)
  },
  deleteSelection: () => {
    const selection = useCursorStore.getState().getSelection()
    const cursor = useCursorStore.getState()
    if (!selection) return null

    const ptStart = getPieceTableCursorPosition(
      selection.start.row,
      selection.start.col,
    )
    const ptEnd = getPieceTableCursorPosition(
      selection.end.row,
      selection.end.col,
    )

    if (ptStart.pieceIndex === ptEnd.pieceIndex) {
      if (ptStart.pieceIndex === -1) {
        cursor.resetSelection()
        return null
      }

      if (
        ptStart.charIndex === ptEnd.charIndex &&
        ptStart.offset > 0 &&
        ptEnd.offset > 0
      ) {
        // the selection only contains padding since they reference the same piece
        cursor.resetSelection()
        return null
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
    return deleteSelection(get().pt, deleteStart, deleteEnd)
  },
  insertAtCursor: (text: string) => {
    const _cursor = useCursorStore.getState()
    let cursor: PieceTableCursor = {
      ..._cursor,
    }

    const pt = { ...get().pt, pieces: [...get().pt.pieces] }
    const selection = useCursorStore.getState().getSelection()
    if (selection) {
      get().deleteSelection()
      cursor = getPieceTableCursorPosition(
        selection.start.row,
        selection.start.col,
      )
    }

    let newText = ''
    if (cursor.offset > 0) {
      if (text !== '\n') {
        newText = ' '.repeat(cursor.offset - (cursor.pieceIndex === -1 ? 0 : 1))
      }
      // if there is an offset, it means we need to insert after the specified character (thus we have charIndex++)
      cursor.charIndex++
    }
    newText += text

    const newCursor = insertText(
      pt,
      cursor.pieceIndex,
      cursor.charIndex,
      newText,
    )
    useCursorStore
      .getState()
      .setCursorByPiece(newCursor.pieceIndex, newCursor.charIndex, 1)
    set({ pt })
  },
  deleteAtCursor: () => {
    const cursor = useCursorStore.getState()
    const selection = useCursorStore.getState().getSelection()
    if (selection) {
      const ptStart = getPieceTableCursorPosition(
        selection.start.row,
        selection.start.col,
      )
      const newCursor = get().deleteSelection() ?? {
        pieceIndex: ptStart.pieceIndex,
        charIndex: ptStart.charIndex,
        offset: ptStart.offset,
      }

      set((state) => {
        const pt = { ...state.pt, pieces: [...state.pt.pieces] }
        useCursorStore
          .getState()
          .setCursorByPiece(
            newCursor.pieceIndex,
            newCursor.charIndex,
            newCursor.offset,
          )
        return { pt }
      })
      return
    }

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
