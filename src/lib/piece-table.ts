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

// Split a piece at a given index, return [left, right]
// If index is 0, left is null; if index === length, right is null
function splitPiece(piece: Piece, index: number): [Piece | null, Piece | null] {
  if (index <= 0) return [null, { ...piece }]
  if (index >= piece.length) return [{ ...piece }, null]

  const left: Piece = {
    buffer: piece.buffer,
    start: piece.start,
    length: index,
  }
  const right: Piece = {
    buffer: piece.buffer,
    start: piece.start + index,
    length: piece.length - index,
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
  charIndex: number,
  document: DocumentState,
) {
  console.log(`[${pieceIndex}][${charIndex}]`, JSON.stringify(pt, null, 2))
  let lastRow = 0
  let lastCol = 0

  for (const { row, col, pieceIndex: i, charIndex: j, ch } of walkPieces(
    pt,
    document,
  )) {
    console.log(`[${i}][${j}]=${ch} -> (${row},${col}) `)
    if (i > pieceIndex) {
      break
    }
    if (i === pieceIndex && j === charIndex) {
      return { curRow: row, curCol: col }
    }
    lastRow = row
    lastCol = col
  }

  return { curRow: lastRow, curCol: lastCol + 1 }
  throw new Error('Could not find position')
}

// Walk the pieces to find the corresponding character position
export function resolveCharPosition(
  pt: PieceTable,
  row: number,
  col: number,
  document: DocumentState,
): {
  isNewline: boolean
  padding: number
  pieceIndex: number
  charIndex: number
} {
  let prev = {
    col: 0,
    pieceIndex: 0,
    charIndex: 0,
    ch: '',
  }

  for (const { row: r, col: c, pieceIndex, charIndex, ch } of walkPieces(
    pt,
    document,
  )) {
    console.log(`(${r},${c}) -> [${pieceIndex}][${charIndex}]=${ch}`)
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
        charIndex: prev.charIndex + (prev.ch === '\n' ? 0 : 1),
      }
    }

    if (r === row && c === col) {
      return {
        isNewline: ch === '\n',
        padding: 0,
        pieceIndex,
        charIndex: charIndex,
      }
    }

    prev = { col: c, pieceIndex, charIndex, ch }
  }

  // if we are here then the cursor is in the last row
  return {
    isNewline: prev.ch === '\n',
    padding: col - (prev.col + 1), // +1 because we want to compare the padding to the position to the right of the previous character
    pieceIndex: prev.pieceIndex,
    charIndex: -1,
  }
}

export function insertAtRowCol(
  pt: PieceTable,
  row: number,
  col: number,
  text: string,
  document: DocumentState,
) {
  let { isNewline, padding, pieceIndex, charIndex } = resolveCharPosition(
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

  if (charIndex === -1) {
    // we are going to insert it after the index (not replacing it)
    pt.pieces.splice(pieceIndex + 1, 0, newPiece)
    console.log(pt)
    return getCursorPosition(
      pt,
      pieceIndex + 1,
      pt.add.length - addStart - 1,
      document,
    )
  }

  if (isNewline && col === 0) {
    // if the char is a newline and the cursor is at the start
    // we want to insert the text after the newline char
    charIndex++
  }

  const [left, right] = splitPiece(pt.pieces[pieceIndex], charIndex)

  const piecesToInsert: Piece[] = []
  if (left) piecesToInsert.push(left)
  piecesToInsert.push(newPiece)
  if (right) piecesToInsert.push(right)

  // Replace the original piece with new pieces
  pt.pieces.splice(pieceIndex, 1, ...piecesToInsert)
  return getCursorPosition(
    pt,
    pieceIndex + (left ? 1 : 0),
    newPiece.length - 1,
    document,
  )
}

export function deleteBackwardsFromRowCol(
  pt: PieceTable,
  row: number,
  col: number,
  length: number,
  document: DocumentState,
) {
  if (length <= 0 || (row === 0 && col === 0)) return

  let { pieceIndex, charIndex } = resolveCharPosition(pt, row, col, document)

  console.log(`found (${row},${col}) [${pieceIndex}][${charIndex}]`)
  console.log(JSON.stringify(pt, null, 2))

  // we have the position of the cursor, but when we are deleting, we need to have the char to the left of the cursor
  if (charIndex < 0) {
    // cursor is at the end of the document -> get the last character of this piece (at pieceIndex)
    charIndex = pt.pieces[pieceIndex].length - 1
  } else if (charIndex === 0) {
    //cursor is at the start of a piece (at pieceIndex) → step into the previous piece
    pieceIndex--
    if (pieceIndex < 0) return
    charIndex = pt.pieces[pieceIndex].length - 1
  } else {
    charIndex--
  }

  let newPieceIndex = pieceIndex
  let newCharIndex = charIndex
  let remaining = length

  const buffer = pt.pieces[pieceIndex].buffer
  const ch = buffer === 'original' ? pt.original[charIndex] : pt.add[charIndex]

  console.log(`actual delete [${pieceIndex}][${charIndex}]=${ch}`)

  while (remaining > 0 && pieceIndex >= 0) {
    const p = pt.pieces[pieceIndex]
    if (charIndex === -1) {
      // if the charIndex is -1, it means we are at the end of the piece
      charIndex = p.length - 1
    }

    if (remaining >= p.length) {
      console.log('delete the whole piece')
      // delete the whole piece
      pt.pieces.splice(pieceIndex, 1)
      remaining -= p.length
      newCharIndex = charIndex
      newPieceIndex = pieceIndex
      pieceIndex--
      charIndex = -1
      continue
    }

    if (charIndex === p.length - 1) {
      console.log('removal from the end')
      // removal from the end
      p.length -= remaining
      newCharIndex = p.length
      break
    }

    if (charIndex === 0) {
      console.log('removal from the start')
      // removal from the start
      p.start += remaining
      p.length -= remaining
      break
    }

    console.log('removal from the middle')
    // otherwise remove it from the middle
    const [left, rest] = splitPiece(p, charIndex)
    if (left && rest) {
      const [_, right] = splitPiece(rest, remaining)
      if (right) {
        pt.pieces.splice(pieceIndex, 1, ...[left, right])
        newPieceIndex = pieceIndex + 1
        newCharIndex = 0
      }
    }
    break
  }
  // if the newCharIndex is -1, then you need to go to the end of the current piece at the newPieceIndex
  console.log(`new [${newPieceIndex}][${newCharIndex}]`)
  return getCursorPosition(pt, newPieceIndex, newCharIndex, document)
}
