import { create } from 'zustand'
import { useDocumentStore, useRowsStore } from './document-store'
import { getCursorPosition, resolveCharPosition } from './piece-table'

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

interface CursorState {
  pieceIndex: number
  charIndex: number
  offset: number
  visible: boolean

  moveCursor: (key: string) => void
  setCursorByPiece: (
    pieceIndex: number,
    charIndex: number,
    offset: number,
  ) => void
  setCursorByRowCol: (row: number, col: number) => void
}

export const useCursorStore = create<CursorState>((set, get) => ({
  pieceIndex: 0,
  charIndex: 0,
  offset: 0,
  visible: true,

  moveCursor: (key: string) => {
    const document = useDocumentStore.getState()
    const pieceIndex = get().pieceIndex
    const charIndex = get().charIndex
    const offset = get().offset
    const { row, col } = getCursorPosition(pieceIndex, charIndex)

    let newRow = 0
    let newCol = 0

    switch (key) {
      case 'ArrowUp':
        newRow = row - 1
        newCol = col + offset
        if (newRow < 0) return
        break
      case 'ArrowDown':
        newRow = row + 1
        newCol = col + offset
        if (newRow >= useRowsStore.getState().rows) return
        break
      case 'ArrowLeft':
        newRow = row
        newCol = col + offset - 1
        if (newCol < 0) return
        break
      case 'ArrowRight':
        newRow = row
        newCol = col + offset + 1
        if (newCol > document.columns) return // allow to go beyond the last column so that we can 'delete' the last character
        break
    }

    const {
      pieceIndex: newPieceIndex,
      charIndex: newCharIndex,
      offset: newOffset,
    } = resolveCharPosition(newRow, newCol)
    set({
      pieceIndex: newPieceIndex,
      charIndex: newCharIndex,
      offset: newOffset,
    })
  },
  setCursorByPiece: (pieceIndex: number, charIndex: number, offset: number) => {
    set({ pieceIndex, charIndex, offset })
  },
  setCursorByRowCol: (row: number, col: number) => {
    const { pieceIndex, charIndex, offset } = resolveCharPosition(row, col)
    set({ pieceIndex, charIndex, offset })
  },
}))
