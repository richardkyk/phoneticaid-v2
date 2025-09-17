import { useMapStore } from './cursor-store'
import { useDocumentStore } from './document-store'

type BufferType = 'original' | 'add'

export interface Piece {
  buffer: BufferType
  start: number
  length: number
}

export interface PieceTable {
  original: string
  add: string
  pieces: Piece[]
}

// Split a piece at a given index, return [left, right]
function splitPiece(piece: Piece, index: number): [Piece, Piece] {
  const leftLength = Math.max(0, Math.min(index, piece.length))
  const rightLength = piece.length - leftLength

  const left: Piece = {
    buffer: piece.buffer,
    start: piece.start,
    length: leftLength,
  }
  const right: Piece = {
    buffer: piece.buffer,
    start: piece.start + leftLength,
    length: rightLength,
  }

  return [left, right]
}

// Get text back out (for debugging / rendering)
export function getText(pt: PieceTable): string {
  return pt.pieces
    .map((p) =>
      (p.buffer === 'original' ? pt.original : pt.add).slice(
        p.start,
        p.start + p.length,
      ),
    )
    .join('')
}

export function getCursorPosition(
  pieceIndex: number,
  charIndex: number,
  pieceMap = useMapStore.getState().pieceMap,
) {
  const pos = pieceMap.get(`${pieceIndex}:${charIndex}`)
  if (pos) {
    const [row, col, newLine] = pos.split(':')
    return {
      row: parseInt(row),
      col: parseInt(col),
      isNewLine: newLine === '1',
    }
  }
  return { row: 0, col: 0, isNewLine: false }
}

// Walk the pieces to find the corresponding character position
export function resolveCharPosition(
  row: number,
  col: number,
): {
  isNewLine: boolean
  offset: number
  pieceIndex: number
  charIndex: number
} {
  let _row = row
  let _col = col === useDocumentStore.getState().columns ? col - 1 : col
  let offset = col === useDocumentStore.getState().columns ? 1 : 0

  const prevCell = () => {
    _col--
    if (_col < 0) {
      _row--
      _col = useDocumentStore.getState().columns
    }
    offset++
  }

  while (_row >= 0 && _col >= 0) {
    const pos = useMapStore.getState().gridMap.get(`${_row}:${_col}`)
    if (pos) {
      const [pieceIndex, charIndex, newLine] = pos.split(':')
      const isNewLine = newLine === '1'

      return {
        isNewLine,
        pieceIndex: parseInt(pieceIndex),
        charIndex: parseInt(charIndex),
        offset,
      }
    }

    prevCell()
  }

  return {
    isNewLine: false,
    pieceIndex: -1,
    charIndex: 0,
    offset: offset - 1,
  }
}

export function insertText(
  pt: PieceTable,
  pieceIndex: number,
  charIndex: number,
  offset: number,
  text: string,
) {
  if (text.length === 0) return { pieceIndex, charIndex, offset }

  const addStart = pt.add.length
  if (offset > 0) {
    // if there is an offset, it means we need to insert after the specified character (thus we have charIndex++)
    if (text !== '\n') {
      pt.add += ' '.repeat(offset - (pieceIndex === -1 ? 0 : 1))
    }
    // special case where we are trying to insert at the beginning of the document
    charIndex++
  }

  if (pieceIndex === -1) {
    pieceIndex = 0
    charIndex = 0
  }

  pt.add += text
  const newPiece: Piece = {
    buffer: 'add',
    start: addStart,
    length: pt.add.length - addStart,
  }

  if (pt.pieces.length === 0) {
    pt.pieces.push(newPiece)
    return {
      pieceIndex: 0,
      charIndex: newPiece.length - 1,
      offset: 1,
    }
  }

  const [left, right] = splitPiece(pt.pieces[pieceIndex], charIndex)

  const piecesToInsert: Piece[] = []
  if (left.length) piecesToInsert.push(left)
  piecesToInsert.push(newPiece)
  if (right.length) piecesToInsert.push(right)

  // Replace the original piece with new pieces
  pt.pieces.splice(pieceIndex, 1, ...piecesToInsert)

  return {
    pieceIndex: pieceIndex + (left.length ? 1 : 0),
    charIndex: newPiece.length - 1,
    offset: 1,
  }
}

interface RangePosition {
  pieceIndex: number
  charIndex: number
}

export function deleteRange(
  pt: PieceTable,
  start: RangePosition,
  end: RangePosition,
) {
  if (start.pieceIndex === end.pieceIndex) {
    // Single-piece deletion
    const piece = pt.pieces[start.pieceIndex]
    const [left, rest] = splitPiece(piece, start.charIndex)
    const [_, right] = splitPiece(
      rest,
      end.charIndex === start.charIndex ? 1 : end.charIndex - start.charIndex,
    )

    const newPieces: Piece[] = []
    if (left.length) newPieces.push(left)
    if (right.length) newPieces.push(right)

    pt.pieces.splice(start.pieceIndex, 1, ...newPieces)

    if (newPieces.length === 0) {
      // if no new pieces were added, move the cursor to the end of the previous piece
      const _pieceIndex = start.pieceIndex - 1
      if (_pieceIndex < 0) return { pieceIndex: -1, charIndex: 0, offset: 0 }
      const _charIndex = pt.pieces[_pieceIndex].length - 1
      return {
        pieceIndex: _pieceIndex,
        charIndex: _charIndex,
        offset: 1,
      }
    }

    if (right.length) {
      // if there is a right piece, move the cursor to the beginning of it
      const _piece = pt.pieces[start.pieceIndex + (left.length ? 1 : 0)]
      const buffer = _piece.buffer === 'original' ? pt.original : pt.add
      const ch = buffer[_piece.start]
      if (ch !== '\n') {
        return {
          pieceIndex: start.pieceIndex + (left.length ? 1 : 0),
          charIndex: 0,
          offset: 0,
        }
      }
    }

    if (left.length) {
      // if there is a left piece, move the cursor to the end of it
      return {
        pieceIndex: start.pieceIndex,
        charIndex: left.length - 1,
        offset: 1,
      }
    }

    return {
      pieceIndex: 0,
      charIndex: 0,
      offset: 0,
    }
  }

  // Multi-piece deletion
  const newPieces: Piece[] = []
  const startPiece = pt.pieces[start.pieceIndex]
  const endPiece = pt.pieces[end.pieceIndex]

  const [left] = splitPiece(startPiece, start.charIndex)
  const [, right] = splitPiece(endPiece, end.charIndex)

  if (left.length) newPieces.push(left)
  if (right.length) newPieces.push(right)

  pt.pieces.splice(
    start.pieceIndex,
    end.pieceIndex - start.pieceIndex + 1,
    ...newPieces,
  )

  return {
    pieceIndex: start.pieceIndex + newPieces.length - 1,
    charIndex: 0,
    offset: 0,
  }
}
export function deleteBackwards(
  pt: PieceTable,
  pieceIndex: number,
  charIndex: number,
  offset: number,
) {
  let startPieceIndex = pieceIndex
  let startCharIndex = charIndex + offset - 1

  if (startCharIndex < 0) {
    // Move to previous piece
    startPieceIndex -= 1
    if (startPieceIndex < 0) return { pieceIndex, charIndex, offset }
    startCharIndex = pt.pieces[startPieceIndex].length - 1
  }

  const start: RangePosition = {
    pieceIndex: startPieceIndex,
    charIndex: startCharIndex,
  }
  const end: RangePosition = { pieceIndex, charIndex }

  return deleteRange(pt, start, end)
}
