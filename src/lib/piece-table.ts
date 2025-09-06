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
  isNewline: boolean
  padding: number
  pieceIndex: number
  offsetInPiece: number
} {
  let prev = {
    col: 0,
    pieceIndex: 0,
    offsetInPiece: 0,
    ch: '',
  }

  for (const { row: r, col: c, pieceIndex, offsetInPiece, ch } of walkPieces(
    pt,
    document,
  )) {
    console.log(`(${r},${c}) [${pieceIndex}][${offsetInPiece}]=${ch}`)
    if (r > row) {
      // if the r is greater than the row we are looking for, then we are working with a virtual cell
      // since the last ch position is for the start of the real char, we need to add 1 to the offset
      // to get the correct position for where we need to maniuplate text for the virtual cell
      //
      // in the case where the prev char is \n, we don't need to add 1 to it, because we want the position of the \n
      // then it is up to the consumer if they wish to maniupate the char before or after the \n
      return {
        isNewline: prev.ch === '\n',
        padding: col - prev.col - (prev.ch === '\n' ? 0 : 1),
        pieceIndex: prev.pieceIndex,
        offsetInPiece: prev.offsetInPiece + (prev.ch === '\n' ? 0 : 1),
      }
    }

    if (r === row && c === col) {
      return {
        isNewline: ch === '\n',
        padding: 0,
        pieceIndex,
        offsetInPiece,
      }
    }

    prev = { col: c, pieceIndex, offsetInPiece, ch }
  }

  // if we are here then the cursor is in the last row
  return {
    isNewline: prev.ch === '\n',
    padding: col - (prev.col + 1), // +1 because we want to compare the padding to the position to the right of the previous character
    pieceIndex: prev.pieceIndex,
    offsetInPiece: -1,
  }
}

export function insertAtRowCol(
  pt: PieceTable,
  row: number,
  col: number,
  text: string,
  document: DocumentState,
) {
  let { isNewline, padding, pieceIndex, offsetInPiece } = getPieceIndex(
    pt,
    row,
    col,
    document,
  )

  if (text.length === 0) return

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

  if (offsetInPiece === -1) {
    // we are going to insert it after the index (not replacing it)
    pt.pieces.splice(pieceIndex + 1, 0, newPiece)
    console.log(pt)
    return getCursorPosition(
      pt,
      pieceIndex + 1,
      pt.add.length - addStart,
      document,
    )
  }

  if (isNewline && col === 0) {
    // if the char is a newline and the cursor is at the start
    // we want to insert the text after the newline char
    offsetInPiece++
  }

  const [left, right] = splitPiece(pt.pieces[pieceIndex], offsetInPiece)

  const piecesToInsert: Piece[] = []
  if (left) piecesToInsert.push(left)
  piecesToInsert.push(newPiece)
  if (right) piecesToInsert.push(right)

  // Replace the original piece with new pieces
  pt.pieces.splice(pieceIndex, 1, ...piecesToInsert)
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
