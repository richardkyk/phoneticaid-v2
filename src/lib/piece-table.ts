import { DocumentState } from './store'

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

export function insertAtRowCol(
  pt: PieceTable,
  row: number,
  col: number,
  text: string,
  document: DocumentState,
) {
  // Append new text to add buffer
  const addStart = pt.add.length
  pt.add += text
  const newPiece: Piece = {
    buffer: 'add',
    start: addStart,
    length: text.length,
  }

  // Find piece index and offset in piece
  const [pieceIndex, offsetInPiece] = getPieceIndex(pt, row, col, document)

  // Split the piece at insertion point
  const [left, right] = splitPiece(pt.pieces[pieceIndex], offsetInPiece)

  const piecesToInsert: Piece[] = []

  if (left) piecesToInsert.push(left) // keep left part
  piecesToInsert.push(newPiece) // insert new piece
  if (right) piecesToInsert.push(right) // keep right part

  // Replace the original piece with new pieces
  pt.pieces.splice(pieceIndex, 1, ...piecesToInsert)
}

// Walk the pieces to find the insertion point
function getPieceIndex(
  pt: PieceTable,
  row: number,
  col: number,
  document: DocumentState,
): [number, number] {
  let curRow = 0
  let curCol = 0

  for (let i = 0; i < pt.pieces.length; i++) {
    const piece = pt.pieces[i]
    const buffer = piece.buffer === 'original' ? pt.original : pt.add

    for (let j = 0; j < piece.length; j++) {
      if (curRow === row && curCol === col) {
        return [i, j]
      }

      curCol++
      if (buffer[piece.start + j] === '\n' || curCol >= document.columns) {
        curRow++
        curCol = 0
      }
    }
  }

  // If row/col is beyond current text, insert at the end
  return [pt.pieces.length - 1, pt.pieces[pt.pieces.length - 1].length]
}

export function deleteBackwardsFromRowCol(
  pt: PieceTable,
  row: number,
  col: number,
  length: number,
  document: DocumentState,
) {
  if (length <= 0) return

  let [pieceIndex, offsetInPiece] = getPieceIndex(pt, row, col, document)
  let remaining = length

  while (remaining > 0 && pieceIndex >= 0) {
    const p = pt.pieces[pieceIndex]

    if (offsetInPiece === 0) {
      // Cursor is at the start of this piece → delete from previous piece
      pieceIndex--
      if (pieceIndex >= 0) {
        offsetInPiece = pt.pieces[pieceIndex].length
      }
      continue
    }

    if (offsetInPiece <= remaining) {
      // Delete whole left part of this piece
      p.length -= offsetInPiece
      offsetInPiece = 0
      remaining -= offsetInPiece

      // If piece becomes empty, remove it
      if (p.length === 0) {
        pt.pieces.splice(pieceIndex, 1)
      } else {
        pieceIndex--
      }
    } else {
      // Delete only part of this piece
      p.length -= remaining
      offsetInPiece -= remaining
      remaining = 0
    }
  }
}

// Split a piece at a given offset, return [left, right]
// If offset is 0, left is null; if offset === length, right is null
function splitPiece(
  piece: Piece,
  offset: number,
): [Piece | null, Piece | null] {
  if (offset <= 0) return [null, { ...piece }]
  if (offset >= piece.length) return [{ ...piece }, null]

  const left: Piece = {
    buffer: piece.buffer,
    start: piece.start,
    length: offset,
  }
  const right: Piece = {
    buffer: piece.buffer,
    start: piece.start + offset,
    length: piece.length - offset,
  }
  return [left, right]
}
