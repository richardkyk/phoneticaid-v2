import { create } from 'zustand'
import { deleteRange, getText, insertText, PieceTable } from '../piece-table'
import { normalisePosition, Position } from '../layout'
import { currentLayout, useCursorStore } from './cursor-store'
import { useHistoryStore } from './history-store'
import { useProjectsStore } from './projects-store'

export interface PieceTableState {
  extractSelection: () => string
  insertAtCursor: (text: string) => void
  deleteAtCursor: (length: number) => void
}

// Commits the new piece table and cursor, recording the change in the history
function commit(
  originalPt: PieceTable,
  before: Position,
  pt: PieceTable,
  after: Position,
) {
  const setActiveProjectAttribute =
    useProjectsStore.getState().setActiveProjectAttribute

  useHistoryStore.getState().push({
    undo: () => {
      setActiveProjectAttribute({ pt: originalPt })
      useCursorStore.getState().setCursor(before)
    },
    redo: () => {
      setActiveProjectAttribute({ pt })
      useCursorStore.getState().setCursor(after)
    },
  })

  setActiveProjectAttribute({ pt })
  useCursorStore.getState().resetSelection()
  useCursorStore.getState().setCursor(after)
}

export const usePieceTableStore = create<PieceTableState>()(() => ({
  extractSelection: () => {
    const selection = useCursorStore.getState().getSelection()
    if (!selection) return ''

    const project = useProjectsStore.getState().getActiveProject()
    return getText(project.pt, selection.start.index, selection.end.index)
  },

  insertAtCursor: (text: string) => {
    text = text.replace(/\r\n?/g, '\n')
    if (text.length === 0) return

    const cursor = useCursorStore.getState()
    const originalPt = useProjectsStore.getState().getActiveProject().pt
    const pt = structuredClone(originalPt)
    const before = cursor.getPosition()

    let at = normalisePosition(currentLayout(), before)
    const selection = cursor.getSelection()
    if (selection) {
      deleteRange(pt, selection.start.index, selection.end.index)
      at = selection.start
    }

    // typing past the end of a line fills the gap with spaces, a newline
    // just breaks the line where the text ends
    const padding = text === '\n' ? '' : ' '.repeat(at.virtual)
    insertText(pt, at.index, padding + text)

    commit(originalPt, before, pt, {
      index: at.index + padding.length + text.length,
      virtual: 0,
      affinity: 'upstream',
    })
  },

  deleteAtCursor: (length: number) => {
    const cursor = useCursorStore.getState()
    const originalPt = useProjectsStore.getState().getActiveProject().pt
    const pt = structuredClone(originalPt)
    const before = cursor.getPosition()

    const selection = cursor.getSelection()
    if (selection) {
      const { start, end } = selection
      if (start.index === end.index) {
        // the selection only covers empty cells, so there is nothing to delete
        cursor.resetSelection()
        cursor.setCursor(start)
        return
      }
      deleteRange(pt, start.index, end.index)
      commit(originalPt, before, pt, { ...start, virtual: 0 })
      return
    }

    if (length === 0) return

    const pos = normalisePosition(currentLayout(), before)
    if (pos.virtual > 0) {
      // in the empty cells past the end of a line, just move back a cell
      cursor.setCursor({ ...pos, virtual: pos.virtual - 1 })
      return
    }
    if (pos.index === 0) return

    const start = Math.max(0, pos.index - length)
    deleteRange(pt, start, pos.index)
    commit(originalPt, before, pt, {
      index: start,
      virtual: 0,
      affinity: 'downstream',
    })
  },
}))
