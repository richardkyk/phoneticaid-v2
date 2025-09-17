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
  pieceIndex: -1,
  charIndex: 0,
  offset: 0,
  visible: true,

  moveCursor: (key: string) => {
    const document = useDocumentStore.getState()
    const pieceIndex = get().pieceIndex
    const charIndex = get().charIndex
    const offset = get().offset
    const { row, col } = getCursorPosition(pieceIndex, charIndex)

    let newRow = row
    let newCol = col + offset

    if (newCol > document.columns) {
      newRow += 1
      newCol = newCol % (document.columns + 1)
    }

    switch (key) {
      case 'ArrowUp':
        newRow -= 1
        if (newRow < 0) return
        break
      case 'ArrowDown':
        newRow += 1
        if (newRow > useRowsStore.getState().rows) return
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
    const { pieceIndex, charIndex, offset, isNewLine } = resolveCharPosition(
      row,
      col,
    )
    console.log(
      `setCursorByRowCol: (${row},${col}) -> [${pieceIndex}][${charIndex}]+${offset}`,
      isNewLine,
    )
    set({ pieceIndex, charIndex, offset })
  },
}))
