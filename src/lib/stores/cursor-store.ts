import { create } from 'zustand'
import { useDocumentStore } from './document-store'
import { useProjectsStore } from './projects-store'
import {
  comparePositions,
  getLayout,
  gridToPosition,
  normalisePosition,
  Position,
  positionToGrid,
} from '../layout'
import { caretRect, type CaretMove } from '../geometry'
import { pageTop, useCameraStore } from './camera-store'

// Layout of the active project using the current document settings
export const currentLayout = () =>
  getLayout(
    useProjectsStore.getState().getActiveProject().pt,
    useDocumentStore.getState().columns,
  )

const initialPosition = (): Position => ({
  index: 0,
  virtual: 0,
  affinity: 'downstream',
})

interface CursorStoreActions {
  getPosition: () => Position
  // scroll: whether to scroll the caret into view
  setCursor: (pos: Position, scroll?: boolean) => void
  setCursorByRowCol: (row: number, col: number, scroll?: boolean) => void
  moveCursor: (move: CaretMove) => void
  getSelection: () => { start: Position; end: Position } | null
  setSelection: (row: number, col: number, isStart: boolean) => void
  selectAll: () => void
  resetSelection: () => void
  reset: () => void
  focus: () => void
  setFocused: (focused: boolean) => void
}

type CursorStoreState = Position &
  CursorStoreActions & {
    // whether the editor has keyboard focus, the caret is only shown when it does
    focused: boolean
    // selection is stored as document positions (not grid positions) so it
    // survives layout changes
    selectionStart: Position | null
    selectionEnd: Position | null
  }

export const useCursorStore = create<CursorStoreState>((set, get) => ({
  ...initialPosition(),
  focused: false,

  selectionStart: null,
  selectionEnd: null,

  getPosition: () => ({
    index: get().index,
    virtual: get().virtual,
    affinity: get().affinity,
  }),
  setCursor: (pos: Position, scroll = true) => {
    set({ index: pos.index, virtual: pos.virtual, affinity: pos.affinity })
    if (!scroll) return
    // need to wait for next frame incase the cursor jumps to the next page
    setTimeout(() => {
      get().focus()
    }, 0)
  },
  setCursorByRowCol: (row: number, col: number, scroll = true) => {
    get().setCursor(gridToPosition(currentLayout(), row, col), scroll)
  },
  moveCursor: (move: CaretMove) => {
    const layout = currentLayout()
    const { row, col } = positionToGrid(layout, get().getPosition())
    const lastRow = layout.lines.length - 1

    let newRow = row
    let newCol = col
    switch (move) {
      case 'lineStart':
        newCol = 0
        break
      case 'lineEnd':
        newCol = layout.columns
        break
      case 'prevLine':
        newRow -= 1
        if (newRow < 0) return
        break
      case 'nextLine':
        newRow += 1
        if (newRow > lastRow) return
        break
      case 'prevChar':
        newCol -= 1
        if (newCol < 0) {
          newCol = layout.columns
          newRow -= 1
          if (newRow < 0) return
        }
        break
      case 'nextChar':
        newCol += 1
        if (newCol > layout.columns) {
          // allow to go beyond the last column so that we can 'delete' the last character
          newCol = 0
          newRow += 1
          if (newRow > lastRow) return
        }
        break
    }

    get().setCursor(gridToPosition(layout, newRow, newCol))
  },
  focus: () => {
    // worked out from the layout rather than the caret element, as the page
    // the caret is on might not be rendered
    const doc = useDocumentStore.getState()
    const { row, col } = positionToGrid(currentLayout(), get().getPosition())
    const linesPerPage = doc.linesPerPage()
    const pageIndex = Math.floor(row / linesPerPage)
    const rect = caretRect(doc, row - pageIndex * linesPerPage, col)
    useCameraStore.getState().reveal({
      x: rect.x * doc.mmX,
      y: pageTop(pageIndex, doc.pageHeight() * doc.mmY) + rect.y * doc.mmY,
      width: rect.width * doc.mmX,
      height: rect.height * doc.mmY,
    })
  },
  getSelection: () => {
    const s = get().selectionStart
    const e = get().selectionEnd
    if (!s || !e) return null
    const layout = currentLayout()
    let start = normalisePosition(layout, s)
    let end = normalisePosition(layout, e)
    if (comparePositions(start, end) > 0) [start, end] = [end, start]
    if (comparePositions(start, end) === 0) return null
    return { start, end }
  },
  setSelection: (row: number, col: number, isStart: boolean) => {
    const pos = gridToPosition(currentLayout(), row, col)
    const key = isStart ? 'selectionStart' : 'selectionEnd'
    const prev = get()[key]
    if (
      prev &&
      comparePositions(prev, pos) === 0 &&
      prev.affinity === pos.affinity
    ) {
      return
    }
    set({ [key]: pos })
  },
  selectAll: () => {
    const layout = currentLayout()
    set({
      selectionStart: initialPosition(),
      selectionEnd: gridToPosition(
        layout,
        layout.lines.length - 1,
        layout.columns,
      ),
    })
  },
  reset: () => {
    set({
      ...initialPosition(),
      selectionStart: null,
      selectionEnd: null,
    })
  },
  setFocused: (focused: boolean) => set({ focused }),
  resetSelection: () => {
    set({ selectionStart: null, selectionEnd: null })
  },
}))
