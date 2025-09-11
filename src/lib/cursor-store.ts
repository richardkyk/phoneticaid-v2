import { create } from 'zustand'
import { useDocumentStore, useRowsStore } from './document-store'
import { getCursorPosition, resolveCharPosition } from './piece-table'
import { usePieceTableStore } from './piece-table-store'

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
  isNewLine: boolean
  offset: number
  visible: boolean

  moveCursor: (key: string) => void
  setCursorByPiece: (
    pieceIndex: number,
    charIndex: number,
    isNewLine: boolean,
    offset: number,
  ) => void
  setCursorByRowCol: (row: number, col: number) => void
}

export const useCursorStore = create<CursorState>((set, get) => ({
  pieceIndex: 0,
  charIndex: 0,
  isNewLine: false,
  offset: 0,
  visible: true,

  moveCursor: (key: string) => {
    const document = useDocumentStore.getState()
    const pieceIndex = get().pieceIndex
    const charIndex = get().charIndex
    const isNewLine = get().isNewLine
    const _offset = get().offset
    const { row, col } = getCursorPosition(pieceIndex, charIndex)

    let newRow = 0
    let newCol = 0
    const offset = isNewLine ? 0 : _offset

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
      isNewLine: newIsNewLine,
      offset: newOffset,
    } = resolveCharPosition(newRow, newCol)
    set({
      pieceIndex: newPieceIndex,
      charIndex: newCharIndex,
      isNewLine: newIsNewLine,
      offset: newOffset,
    })
  },
  setCursorByPiece: (
    pieceIndex: number,
    charIndex: number,
    isNewLine: boolean,
    offset: number,
  ) => {
    let _charIndex = charIndex
    let _pieceIndex = pieceIndex

    if (isNewLine) {
      const pt = usePieceTableStore.getState().pt
      _charIndex = charIndex - 1
      _pieceIndex = pieceIndex
      if (_charIndex < 0) {
        _pieceIndex -= 1
        if (_pieceIndex < 0) return
        const piece = pt.pieces[_pieceIndex]
        _charIndex = piece.length - 1
      }
    }
    set({ pieceIndex: _pieceIndex, charIndex: _charIndex, isNewLine, offset })
  },
  setCursorByRowCol: (row: number, col: number) => {
    const { pieceIndex, charIndex, isNewLine, offset } = resolveCharPosition(
      row,
      col,
    )
    set({ pieceIndex, charIndex, isNewLine, offset })
  },
}))
