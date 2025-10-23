import { create } from 'zustand'
import { useDocumentStore, useRowsStore } from './document-store'
import {
  getGridCursorPosition,
  normaliseGridPosition,
  PieceTablePosition,
  getPieceTableCursorPosition,
} from '../piece-table'

interface MapStore {
  gridMap: Map<string, string>
  pieceMap: Map<string, string>

  setGridMap: (gridMap: Map<string, string>) => void
  setPieceMap: (pieceMap: Map<string, string>) => void
}

export const useMapStore = create<MapStore>((set) => ({
  gridMap: new Map(),
  pieceMap: new Map(),
  setGridMap: (gridMap: Map<string, string>) => set({ gridMap }),
  setPieceMap: (pieceMap: Map<string, string>) => set({ pieceMap }),
}))

export interface GridPosition {
  row: number
  col: number
}

export type PieceTableCursor = PieceTablePosition & {
  offset: number
}

interface CursorStoreActions {
  moveCursor: (key: string) => void
  setCursorByPiece: (
    pieceIndex: number,
    charIndex: number,
    offset: number,
  ) => void
  getSelection: () => { start: GridPosition; end: GridPosition } | null
  setCursorByRowCol: (row: number, col: number) => void
  setSelection: (row: number, col: number, isStart: boolean) => void
  selectAll: () => void
  resetSelection: () => void
}

type CursorStoreState = PieceTableCursor &
  CursorStoreActions & {
    visible: boolean
    selectionStart: { row: number; col: number } | null
    selectionEnd: { row: number; col: number } | null
  }

export const useCursorStore = create<CursorStoreState>((set, get) => ({
  pieceIndex: -1,
  charIndex: 0,
  offset: 0,
  visible: true,

  selectionStart: null,
  selectionEnd: null,

  moveCursor: (key: string) => {
    const document = useDocumentStore.getState()
    const pieceIndex = get().pieceIndex
    const charIndex = get().charIndex
    const offset = get().offset
    const { row, col } = getGridCursorPosition(pieceIndex, charIndex)

    let newRow = row
    let newCol = col + offset

    if (newCol > document.columns) {
      newRow += 1
      newCol = newCol % (document.columns + 1)
    }
    switch (key) {
      case 'Home':
        newCol = 0
        break
      case 'End':
        newCol = document.columns
        break
      case 'ArrowUp':
        newRow -= 1
        if (newRow < 0) return
        break
      case 'ArrowDown':
        newRow += 1
        if (newRow >= useRowsStore.getState().rows) return
        break
      case 'ArrowLeft':
        newCol -= 1
        if (newCol < 0) {
          newCol = document.columns
          newRow -= 1
          if (newRow < 0) return
        }
        break
      case 'ArrowRight':
        newCol += 1
        if (newCol > document.columns) {
          // allow to go beyond the last column so that we can 'delete' the last character
          newCol = 0
          newRow += 1
          if (newRow >= useRowsStore.getState().rows) return
        }
        break
    }

    const {
      pieceIndex: newPieceIndex,
      charIndex: newCharIndex,
      offset: newOffset,
    } = getPieceTableCursorPosition(newRow, newCol)
    set({
      pieceIndex: newPieceIndex,
      charIndex: newCharIndex,
      offset: newOffset,
    })
  },
  getSelection: () => {
    const s = get().selectionStart
    const e = get().selectionEnd
    if (!s || !e) return null
    if (s.row === e.row && s.col === e.col) return null
    const [start, end] = normaliseGridPosition(s, e)
    return { start, end }
  },
  setCursorByPiece: (pieceIndex: number, charIndex: number, offset: number) => {
    set({ pieceIndex, charIndex, offset })
  },
  setCursorByRowCol: (row: number, col: number) => {
    const { pieceIndex, charIndex, offset } = getPieceTableCursorPosition(
      row,
      col,
    )
    set({ pieceIndex, charIndex, offset })
  },
  setSelection: (row: number, col: number, isStart: boolean) => {
    const pos = { row, col }
    if (isStart) {
      const prevPos = get().selectionStart
      if (prevPos && prevPos.row === row && prevPos.col === col) return
      set({ selectionStart: pos })
    } else {
      const prevPos = get().selectionEnd
      if (prevPos && prevPos.row === row && prevPos.col === col) return
      set({ selectionEnd: pos })
    }
  },
  selectAll: () => {
    set({
      selectionStart: { row: 0, col: 0 },
      selectionEnd: {
        row: useRowsStore.getState().rows - 1,
        col: useDocumentStore.getState().columns,
      },
    })
  },
  resetSelection: () => {
    set({ selectionStart: null, selectionEnd: null })
  },
}))
