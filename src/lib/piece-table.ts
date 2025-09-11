import { useMapStore } from './cursor-store'
import { DocumentState, useDocumentStore } from './document-store'

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

export function getCursorPosition(pieceIndex: number, charIndex: number) {
  const pos = useMapStore.getState().pieceMap.get(`${pieceIndex}:${charIndex}`)
  if (pos) {
    const [row, col] = pos.split(':')
    return { row: parseInt(row), col: parseInt(col) }
  }
  return { row: 0, col: 0 }
}

// Walk the pieces to find the corresponding character position
export function resolveCharPosition(
  row: number,
  col: number,
): {
  isNewline: boolean
  offset: number
  pieceIndex: number
  charIndex: number
} {
  let _row = row
  let _col = col
  let offset = 0
  while (_row >= 0 && _col >= 0) {
    const pos = useMapStore.getState().gridMap.get(`${_row}:${_col}`)
    if (pos) {
      const [pieceIndex, charIndex, newLine] = pos.split(':')
      const isNewline = newLine === '1'

      return {
        isNewline,
        offset,
        pieceIndex: parseInt(pieceIndex),
        charIndex: parseInt(charIndex),
      }
    }
    _col--
    if (_col < 0) {
      _row--
      _col = useDocumentStore.getState().columns - 1
    }
    offset++
  }

  throw new Error('Could not resolve char position')
}

interface InsertTextArgs {
  pt: PieceTable
  pieceIndex: number
  charIndex: number
  offset: number
  text: string
}
export function insertText(args: InsertTextArgs) {
  const { pt, pieceIndex, offset, text } = args
  let charIndex = args.charIndex
  if (args.text.length === 0) return { pieceIndex, charIndex, offset }

  const addStart = pt.add.length
  if (offset > 0) {
    pt.add += ' '.repeat(offset - 1)
    charIndex++
  }
  pt.add += text
  const newPiece: Piece = {
    buffer: 'add',
    start: addStart,
    length: pt.add.length - addStart,
  }

  const [left, right] = splitPiece(pt.pieces[pieceIndex], charIndex)

  const piecesToInsert: Piece[] = []
  if (left.length) piecesToInsert.push(left)
  piecesToInsert.push(newPiece)
  if (right.length) piecesToInsert.push(right)

  // Replace the original piece with new pieces
  pt.pieces.splice(pieceIndex, 1, ...piecesToInsert)
  console.log('after', JSON.stringify(pt, null, 2))

  return {
    pieceIndex: pieceIndex + (left ? 1 : 0),
    charIndex: newPiece.length - 1,
    offset: 1,
  }
}

interface RangePosition {
  pieceIndex: number
  charIndex: number
  offset: number
}

export function deleteRange(
  pt: PieceTable,
  start: RangePosition,
  end: RangePosition,
) {
  const startPiece = pt.pieces[start.pieceIndex]
  const endPiece = pt.pieces[end.pieceIndex]

  if (start.pieceIndex === end.pieceIndex && start.charIndex === 0) {
    // delete from start
    const deleteCount =
      end.charIndex === start.charIndex ? 1 : end.charIndex - start.charIndex
    console.log('delete from start', deleteCount)
    startPiece.start += deleteCount
    startPiece.length -= deleteCount
    if (startPiece.length === 0) pt.pieces.splice(start.pieceIndex, 1)
    return getCursorPosition(start.pieceIndex, start.charIndex)
  }
  if (
    start.pieceIndex === end.pieceIndex &&
    end.charIndex === endPiece.length - 1
  ) {
    // delete from end
    const deleteCount =
      end.charIndex === start.charIndex ? 1 : end.charIndex - start.charIndex
    console.log('delete from end', deleteCount)
    endPiece.length -= deleteCount
    if (endPiece.length === 0) pt.pieces.splice(end.pieceIndex, 1)
    return getCursorPosition(start.pieceIndex, start.charIndex)
  }

  // delete from middle
  const newPieces: Piece[] = []

  if (start.pieceIndex === end.pieceIndex) {
    // middle of same piece
    console.log('delete from middle of same piece')
    const [startLeft, startRight] = splitPiece(startPiece, start.charIndex)
    if (startLeft.length) newPieces.push(startLeft)
    const [_endLeft, endRight] = splitPiece(
      startRight,
      end.charIndex - start.charIndex + 1,
    )
    if (endRight.length) newPieces.push(endRight)
    console.log(JSON.stringify({ startLeft, startRight }, null, 2))
  } else {
    console.log('delete from middle of different pieces')
    const [startLeft, _startRight] = splitPiece(startPiece, start.charIndex)
    if (startLeft.length) newPieces.push(startLeft)
    const [_endLeft, endRight] = splitPiece(endPiece, end.charIndex)
    if (endRight.length) newPieces.push(endRight)
  }

  // Splice out everything from startPiece → endPiece (inclusive),
  // and replace with whatever survived
  pt.pieces.splice(
    start.pieceIndex,
    end.pieceIndex - start.pieceIndex + 1,
    ...newPieces,
  )

  // Cursor ends up at start
  return getCursorPosition(start.pieceIndex, start.charIndex)
}
export function deleteBackwards(
  pt: PieceTable,
  row: number,
  col: number,
  document: DocumentState,
) {
  const end = resolveCharPosition(row, col)
  console.log(JSON.stringify({ end }, null, 2))
  const startRow = col === 0 ? row - 1 : row
  const startCol = col === 0 ? document.columns : col - 1
  if (startCol < 0) return
  if (end.offset > 1) {
    return { row: startRow, col: startCol }
  }
  const start = resolveCharPosition(startRow, startCol)
  console.log(JSON.stringify({ start, end }, null, 2))
  return deleteRange(pt, start, end)
}
