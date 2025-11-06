import { create } from 'zustand'
import {
  deleteBackwards,
  getText,
  insertText,
  PieceTable,
  getPieceTableCursorPosition,
  deleteRange,
} from '../piece-table'
import { PieceTableCursor, useCursorStore } from './cursor-store'
import { useHistoryStore } from './history-store'
import { persist } from 'zustand/middleware'

const original = `你好，歡迎來到我的網站！`

export interface PieceTableState {
  pt: PieceTable
  setPt: (pt: PieceTable) => void
  extractSelection: () => string
  deleteSelection: (pt: PieceTable) => PieceTableCursor | null
  insertAtCursor: (substr: string) => void
  deleteAtCursor: (length: number) => void
}

export const usePieceTableStore = create<PieceTableState>()(
  persist(
    (set, get) => ({
      pt: {
        original: original,
        add: '',
        pieces: [
          {
            buffer: 'original',
            start: 0,
            length: original.length,
          },
        ],
      },
      setPt: (pt: PieceTable) => set({ pt }),
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
            ptStart.pieceIndex < 0
              ? 0
              : ptStart.charIndex + (ptStart.offset > 0 ? 1 : 0),
        }
        const extractEnd = {
          pieceIndex: ptEnd.pieceIndex < 0 ? 0 : ptEnd.pieceIndex,
          charIndex:
            ptEnd.pieceIndex < 0
              ? 0
              : ptEnd.charIndex + (ptEnd.offset > 0 ? 1 : 0),
        }
        return getText(get().pt, extractStart, extractEnd)
      },
      deleteSelection: (pt: PieceTable) => {
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

          if (ptStart.charIndex === ptEnd.charIndex) {
            if (ptStart.offset === ptEnd.offset) {
              // the selection is referencing the same cursor position
              // i.e. nothing is actually selected
              cursor.resetSelection()
              return null
            }

            if (ptStart.offset > 0 && ptEnd.offset > 0) {
              // the selection only contains padding since they reference the same piece
              cursor.resetSelection()
              return null
            }
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
        return deleteRange(pt, deleteStart, deleteEnd)
      },
      insertAtCursor: (text: string) => {
        const cursor = useCursorStore.getState()
        let newCursor = {
          pieceIndex: cursor.pieceIndex,
          charIndex: cursor.charIndex,
          offset: cursor.offset,
        }

        const originalPt = structuredClone(get().pt)
        const pt = structuredClone(get().pt)
        const selection = useCursorStore.getState().getSelection()
        if (selection) {
          get().deleteSelection(pt)
          newCursor = getPieceTableCursorPosition(
            selection.start.row,
            selection.start.col,
          )
        }

        let newText = ''
        if (newCursor.offset > 0) {
          if (text !== '\n') {
            newText = ' '.repeat(
              newCursor.offset - (newCursor.pieceIndex === -1 ? 0 : 1),
            )
          }
          // if there is an offset, it means we need to insert after the specified character (thus we have charIndex++)
          newCursor.charIndex++
        }
        newText += text

        const res = insertText(
          pt,
          newCursor.pieceIndex,
          newCursor.charIndex,
          newText,
        )
        useCursorStore
          .getState()
          .setCursorByPiece(res.pieceIndex, res.charIndex, 1)

        // pt should now be mutated to its final state
        const newPt = structuredClone(pt)
        const history = useHistoryStore.getState()
        history.push({
          undo: () => {
            usePieceTableStore.getState().setPt(originalPt)
            useCursorStore
              .getState()
              .setCursorByPiece(
                cursor.pieceIndex,
                cursor.charIndex,
                cursor.offset,
              )
          },
          redo: () => {
            usePieceTableStore.getState().setPt(newPt)
            useCursorStore
              .getState()
              .setCursorByPiece(res.pieceIndex, res.charIndex, 1)
          },
        })

        set({ pt })
      },
      deleteAtCursor: (length: number) => {
        const cursor = useCursorStore.getState()
        let newCursor = {
          pieceIndex: cursor.pieceIndex,
          charIndex: cursor.charIndex,
          offset: cursor.offset,
        }

        const history = useHistoryStore.getState()
        const originalPt = structuredClone(get().pt)
        const pt = structuredClone(get().pt)
        const selection = useCursorStore.getState().getSelection()
        if (selection) {
          const _newCursor = get().deleteSelection(pt)
          if (_newCursor) newCursor = _newCursor
          useCursorStore
            .getState()
            .setCursorByPiece(
              newCursor.pieceIndex,
              newCursor.charIndex,
              newCursor.offset,
            )
          history.push({
            undo: () => {
              usePieceTableStore.getState().setPt(originalPt)
              useCursorStore
                .getState()
                .setCursorByPiece(
                  cursor.pieceIndex,
                  cursor.charIndex,
                  cursor.offset,
                )
            },
            redo: () => {
              usePieceTableStore.getState().setPt(pt)
              useCursorStore
                .getState()
                .setCursorByPiece(
                  newCursor.pieceIndex,
                  newCursor.charIndex,
                  newCursor.offset,
                )
            },
          })

          set({ pt })
          return
        }

        if (length === 0) return

        if (
          cursor.pieceIndex <= 0 &&
          cursor.charIndex === 0 &&
          cursor.offset === 0
        )
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

        newCursor = deleteBackwards(
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

        // pt should now be mutated to its final state
        const newPt = structuredClone(pt)
        history.push({
          undo: () => {
            usePieceTableStore.getState().setPt(originalPt)
            useCursorStore
              .getState()
              .setCursorByPiece(
                cursor.pieceIndex,
                cursor.charIndex,
                cursor.offset,
              )
          },
          redo: () => {
            usePieceTableStore.getState().setPt(newPt)
            useCursorStore
              .getState()
              .setCursorByPiece(
                newCursor.pieceIndex,
                newCursor.charIndex,
                newCursor.offset,
              )
          },
        })

        set({ pt })
      },
    }),
    {
      name: 'piece-table',
      partialize: (state) => {
        const original = getText(state.pt)

        if (original) {
          return {
            pt: {
              original,
              add: '',
              pieces: [
                {
                  buffer: 'original',
                  start: 0,
                  length: original.length,
                },
              ],
            },
          }
        } else {
          return {
            pt: {
              original,
              add: '',
              pieces: [],
            },
          }
        }
      },
    },
  ),
)
