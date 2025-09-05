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
  const { padding, pieceIndex, offsetInPiece } = getPieceIndex(
    pt,
    row,
    col,
    document,
  )
  if (padding) {
    // since we are in padding, there is no piece that spans this area
    // so we can just insert the new piece at the end
    // but we need to pad the piece based on the offset
    const piecesToInsert: Piece[] = []

    if (offsetInPiece > 0) {
      pt.add += ' '.repeat(offsetInPiece)
      const paddingPiece: Piece = {
        buffer: 'add',
        start: pt.add.length,
        length: offsetInPiece,
      }
      piecesToInsert.push(paddingPiece)
    }
    piecesToInsert.push(newPiece)

    pt.pieces.splice(pieceIndex, 0, ...piecesToInsert)
    return
  }

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
): {
  padding: boolean
  pieceIndex: number
  offsetInPiece: number
} {
  let curRow = 0
  let curCol = 0

  for (let i = 0; i < pt.pieces.length; i++) {
    const piece = pt.pieces[i]
    const buffer = piece.buffer === 'original' ? pt.original : pt.add

    for (let j = 0; j <= piece.length; j++) {
      if (curRow === row && curCol === col) {
        return { padding: false, pieceIndex: i, offsetInPiece: j }
      }

      curCol++
      if (buffer[piece.start + j] === '\n' || curCol >= document.columns) {
        // we are about to go to the next row
        if (curRow === row) {
          // since we are in the target row, and about to go to the next row, this must mean we are in padding
          return {
            padding: true,
            pieceIndex: i,
            offsetInPiece: col - curCol,
          }
        }

        curRow++
        curCol = 0
      }
    }
  }

  // otherwise return the last piece
  return {
    padding: true,
    pieceIndex: pt.pieces.length - 1,
    offsetInPiece: pt.pieces[pt.pieces.length - 1].length,
  }
}

export function deleteBackwardsFromRowCol(
  pt: PieceTable,
  row: number,
  col: number,
  length: number,
  document: DocumentState,
) {
  if (length <= 0) return

  let { padding, pieceIndex, offsetInPiece } = getPieceIndex(
    pt,
    row,
    col,
    document,
  )
  // Cursor is in padding → nothing to delete
  if (padding) return

  let remaining = length

  while (remaining > 0 && pieceIndex >= 0) {
    const p = pt.pieces[pieceIndex]

    if (remaining >= p.length) {
      // delete the whole piece
      pt.pieces.splice(pieceIndex, 1)
      remaining -= p.length
      pieceIndex--
      continue
    }

    if (offsetInPiece === 0 || offsetInPiece === remaining) {
      // removal from the start
      p.start += remaining
      p.length -= remaining
      remaining = 0
      continue
    }

    if (offsetInPiece === p.length) {
      // removal from the end
      p.length -= remaining
      remaining = 0
      continue
    }

    // otherwise remove it from the middle
    const [left, rest] = splitPiece(p, offsetInPiece - remaining)
    if (left && rest) {
      const [_, right] = splitPiece(rest, remaining)
      if (right) {
        pt.pieces.splice(pieceIndex, 1, ...[left, right])
      }
    }
    remaining = 0
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
