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

export function textLength(pt: PieceTable) {
  return pt.pieces.reduce((sum, p) => sum + p.length, 0)
}

// Returns the text between the absolute offsets [start, end)
export function getText(
  pt: PieceTable,
  start = 0,
  end = Number.POSITIVE_INFINITY,
): string {
  if (end < start) [start, end] = [end, start]

  let result = ''
  let pieceStart = 0
  for (const piece of pt.pieces) {
    const pieceEnd = pieceStart + piece.length
    if (pieceEnd > start && pieceStart < end) {
      const buffer = piece.buffer === 'original' ? pt.original : pt.add
      const from = Math.max(start, pieceStart) - pieceStart
      const to = Math.min(end, pieceEnd) - pieceStart
      result += buffer.slice(piece.start + from, piece.start + to)
    }
    if (pieceEnd >= end) break
    pieceStart = pieceEnd
  }
  return result
}

// Splits pieces so that a piece boundary exists at `index`, and returns the
// index of the first piece starting at (or after) `index`
function splitAt(pt: PieceTable, index: number): number {
  let pieceStart = 0
  for (let i = 0; i < pt.pieces.length; i++) {
    const piece = pt.pieces[i]
    if (index === pieceStart) return i
    if (index < pieceStart + piece.length) {
      const leftLength = index - pieceStart
      pt.pieces.splice(
        i,
        1,
        { buffer: piece.buffer, start: piece.start, length: leftLength },
        {
          buffer: piece.buffer,
          start: piece.start + leftLength,
          length: piece.length - leftLength,
        },
      )
      return i + 1
    }
    pieceStart += piece.length
  }
  return pt.pieces.length
}

// Mutates the piece table, inserting `text` at the absolute offset `index`
export function insertText(pt: PieceTable, index: number, text: string) {
  if (text.length === 0) return
  index = Math.max(0, Math.min(index, textLength(pt)))

  const piece: Piece = {
    buffer: 'add',
    start: pt.add.length,
    length: text.length,
  }
  pt.add += text
  pt.pieces.splice(splitAt(pt, index), 0, piece)
}

// Mutates the piece table, deleting the text between the absolute offsets [start, end)
export function deleteRange(pt: PieceTable, start: number, end: number) {
  if (end < start) [start, end] = [end, start]
  const length = textLength(pt)
  start = Math.max(0, Math.min(start, length))
  end = Math.max(0, Math.min(end, length))
  if (start === end) return

  const first = splitAt(pt, start)
  const last = splitAt(pt, end)
  pt.pieces.splice(first, last - first)
}
