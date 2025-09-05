import { walkPieces } from './render'
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
  pt: PieceTable,
  pieceIndex: number,
  offsetInPiece: number,
  document: DocumentState,
) {
  for (const { row, col, pieceIndex: i, offsetInPiece: j } of walkPieces(
    pt,
    document,
  )) {
    if (i === pieceIndex && j === offsetInPiece) {
      return { curRow: row, curCol: col }
    }
  }

  // fallback: cursor at the end of the last piece
  const lastPiece = pt.pieces[pt.pieces.length - 1]
  const lastOffset = lastPiece.length - 1
  for (const { row, col, pieceIndex: i, offsetInPiece: j } of walkPieces(
    pt,
    document,
  )) {
    if (i === pt.pieces.length - 1 && j === lastOffset) {
      return { curRow: row, curCol: col + 1 } // cursor after last character
    }
  }

  // default fallback
  return { curRow: 0, curCol: 0 }
}

// Walk the pieces to find the insertion point
export function getPieceIndex(
  pt: PieceTable,
  row: number,
  col: number,
  document: DocumentState,
): {
  padding: number
  pieceIndex: number
  offsetInPiece: number
} {
  let lastCol = 0
  let lastPieceIndex = 0
  let lastOffsetInPiece = 0

  let prevCol = 0
  let prevPieceIndex = 0
  let prevOffsetInPiece = 0
  console.log(`searching for cell (${row}, ${col})`)

  for (const { row: r, col: c, pieceIndex, offsetInPiece } of walkPieces(
    pt,
    document,
  )) {
    lastCol = c
    lastPieceIndex = pieceIndex
    lastOffsetInPiece = offsetInPiece

    console.log(`(${r}, ${c}) ${pieceIndex} ${offsetInPiece}`)

    if (r === row && c === col) {
      return { padding: 0, pieceIndex, offsetInPiece }
    }

    if (r > row) {
      console.log('in virtual cell, padding: ', col - prevCol)
      return {
        padding: col - prevCol,
        pieceIndex: prevPieceIndex,
        offsetInPiece: prevOffsetInPiece,
      }
    }
    prevCol = c
    prevPieceIndex = pieceIndex
    prevOffsetInPiece = offsetInPiece
  }

  return {
    padding: col - lastCol - 1,
    pieceIndex: lastPieceIndex + 1,
    offsetInPiece: 0,
  }
}

export function insertAtRowCol(
  pt: PieceTable,
  row: number,
  col: number,
  text: string,
  document: DocumentState,
) {
  console.log('before', JSON.stringify(pt, null, 2))

  const { padding, pieceIndex, offsetInPiece } = getPieceIndex(
    pt,
    row,
    col,
    document,
  )
  console.log(
    `found corresponding piece at index ${pieceIndex} and offset ${offsetInPiece}`,
  )

  const addStart = pt.add.length
  if (padding > 0) {
    pt.add += ' '.repeat(padding)
  }
  pt.add += text
  const newPiece: Piece = {
    buffer: 'add',
    start: addStart,
    length: pt.add.length - addStart,
  }

  if (pieceIndex > pt.pieces.length) {
    pt.pieces.push(newPiece)
    return getCursorPosition(pt, pt.pieces.length - 1, pt.add.length, document)
  }

  // Split the piece at insertion point
  const [left, right] = splitPiece(pt.pieces[pieceIndex], offsetInPiece)

  const piecesToInsert: Piece[] = []

  if (left) piecesToInsert.push(left) // keep left part
  piecesToInsert.push(newPiece) // insert new piece
  if (right) piecesToInsert.push(right) // keep right part

  console.log('piecesToInsert', piecesToInsert)

  // Replace the original piece with new pieces
  pt.pieces.splice(pieceIndex, 1, ...piecesToInsert)
  console.log('after', JSON.stringify(pt, null, 2))
  return getCursorPosition(pt, pieceIndex + 2, 0, document)
}

export function deleteBackwardsFromRowCol(
  pt: PieceTable,
  row: number,
  col: number,
  length: number,
  document: DocumentState,
) {
  if (length <= 0 || (row === 0 && col === 0)) return

  let { pieceIndex, offsetInPiece } = getPieceIndex(pt, row, col, document)

  // the piece index that was returned is for the piece to the right of the cursor
  if (offsetInPiece > 0) {
    offsetInPiece--
  } else {
    // at the start of a piece → step into the previous piece
    pieceIndex--
    if (pieceIndex < 0) return
    offsetInPiece = pt.pieces[pieceIndex].length - 1
  }

  let newPieceIndex = pieceIndex
  let newOffsetInPiece = offsetInPiece
  let remaining = length

  while (remaining > 0 && pieceIndex >= 0) {
    const p = pt.pieces[pieceIndex]

    if (remaining >= p.length) {
      console.log('delete the whole piece')
      // delete the whole piece
      pt.pieces.splice(pieceIndex, 1)
      remaining -= p.length
      newPieceIndex = pieceIndex
      pieceIndex--
      continue
    }

    if (offsetInPiece === 0 || offsetInPiece === remaining) {
      console.log('removal from the start')
      // removal from the start
      p.start += remaining
      p.length -= remaining
      newPieceIndex = pieceIndex
      break
    }

    if (offsetInPiece === p.length) {
      console.log('removal from the end')
      // removal from the end
      p.length -= remaining
      newPieceIndex = pieceIndex + 1
      newOffsetInPiece = p.length
      break
    }

    console.log('removal from the middle')

    // otherwise remove it from the middle
    const [left, rest] = splitPiece(p, offsetInPiece - remaining)
    if (left && rest) {
      const [_, right] = splitPiece(rest, remaining)
      if (right) {
        pt.pieces.splice(pieceIndex, 1, ...[left, right])
      }
    }
    newPieceIndex = pieceIndex + 1
    break
  }
  return getCursorPosition(pt, newPieceIndex, newOffsetInPiece, document)
}
