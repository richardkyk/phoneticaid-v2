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

const original = `　　　　　半天班(閉班)

1.謝恩禮
謝謝明明上帝　　　　　　　十叩首
謝謝諸天神聖　　　　　　　五叩首
謝謝彌勒祖師　　　　　　　五叩首
謝謝南海古佛　　　　　　　三叩首
謝謝活佛師尊　　　　　　　三叩首
謝謝月慧菩薩　　　　　　　三叩首
謝謝各位法律主　　　　　　三叩首
謝謝灶君　　　　　　　　　一叩首
謝謝師尊　　　　　　　　　一叩首
謝謝師母　　　　　　　　　一叩首
謝謝鎮殿元帥　　　　　　　一叩首
謝謝鎮殿將軍　　　　　　　一叩首
謝謝教化菩薩　　　　　　　一叩首
謝謝各位大仙　　　　　　　一叩首
謝謝老前人　　　　　　　　一叩首
謝謝前人　　　　　　　　　一叩首
謝謝點傳師　　　　　　　　一叩首
謝謝引保師　　　　　　　　一叩首
謝謝前賢大眾　　　　　　　一叩首
謝謝自己祖先　　　　　　　一叩首
謝謝金公祖師　　　　　　　五叩首
謝謝天然古佛　　　　　　　五叩首
謝謝中華聖母　　　　　　　五叩首
謝謝鑒班院長　　　　　　　三叩首
謝謝護壇大仙　　　　　　　三叩首
謝謝白水聖帝　　　　　　　三叩首
謝謝德慧菩薩　　　　　　　三叩首
謝謝白陽仙真　　　　　　　三叩首
起　作揖　跪
謝謝點傳師　　　　　　　　一叩首
謝謝前賢大眾　　　　　　　一叩首
起　作揖　跪

2.送佛駕禮
明明上帝　　　　　　　　　十叩首
諸天神聖　　　　　　　　　五叩首
起　作揖　跪

3.辭駕禮
明明上帝　　　　　　　　　五叩首
諸天神聖　　　　　　　　　三叩首
彌勒祖師　　　　　　　　　三叩首
南海古佛　　　　　　　　　一叩首
活佛師尊　　　　　　　　　一叩首
月慧菩薩　　　　　　　　　一叩首
師尊　　　　　　　　　　　一叩首
師母　　　　　　　　　　　一叩首
點傳師　　　　　　　　　　一叩首
引保師　　　　　　　　　　一叩首
前賢大眾　　　　　　　　　一叩首
起　作揖　跪
向點傳師辭駕　　　　　　　一叩首
起　作揖　　　　叩頭禮畢垂手鞠躬
`

export interface PieceTableState {
  pt: PieceTable
  setPt: (pt: PieceTable) => void
  extractSelection: () => string
  deleteSelection: (pt: PieceTable) => PieceTableCursor | null
  insertAtCursor: (substr: string) => void
  deleteAtCursor: (length: number) => void
}

export const usePieceTableStore = create<PieceTableState>((set, get) => ({
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
        ptStart.pieceIndex < 0 ? 0 : ptStart.charIndex + ptStart.offset,
    }
    const extractEnd = {
      pieceIndex: ptEnd.pieceIndex < 0 ? 0 : ptEnd.pieceIndex,
      charIndex: ptEnd.pieceIndex < 0 ? 0 : ptEnd.charIndex + ptEnd.offset,
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
    useCursorStore.getState().setCursorByPiece(res.pieceIndex, res.charIndex, 1)

    // pt should now be mutated to its final state
    const newPt = structuredClone(pt)
    const history = useHistoryStore.getState()
    history.push({
      undo: () => {
        usePieceTableStore.getState().setPt(originalPt)
        useCursorStore
          .getState()
          .setCursorByPiece(cursor.pieceIndex, cursor.charIndex, cursor.offset)
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
          .setCursorByPiece(cursor.pieceIndex, cursor.charIndex, cursor.offset)
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
}))
