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

// Helper: get total text length
function getLength(pt: PieceTable): number {
  return pt.pieces.reduce((sum, p) => sum + p.length, 0)
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

// Insert substring at absolute position
export function insertTextAt(pt: PieceTable, pos: number, text: string): void {
  if (pos < 0 || pos > getLength(pt)) throw new Error('Out of range')
  if (text.length === 0) return

  // Append text to add buffer
  const addStart = pt.add.length
  pt.add += text

  let offset = 0
  for (let i = 0; i < pt.pieces.length; i++) {
    const p = pt.pieces[i]
    if (pos <= offset + p.length) {
      const relPos = pos - offset

      if (relPos === 0) {
        // Insert before this piece
        pt.pieces.splice(i, 0, {
          buffer: 'add',
          start: addStart,
          length: text.length,
        })
      } else if (relPos === p.length) {
        // Insert after this piece
        pt.pieces.splice(i + 1, 0, {
          buffer: 'add',
          start: addStart,
          length: text.length,
        })
      } else {
        // Split piece into left + new + right
        const left: Piece = { buffer: p.buffer, start: p.start, length: relPos }
        const right: Piece = {
          buffer: p.buffer,
          start: p.start + relPos,
          length: p.length - relPos,
        }
        const newPiece: Piece = {
          buffer: 'add',
          start: addStart,
          length: text.length,
        }

        pt.pieces.splice(i, 1, left, newPiece, right)
      }
      return
    }
    offset += p.length
  }

  // If pos == end
  pt.pieces.push({ buffer: 'add', start: addStart, length: text.length })
}

// Delete a range [pos, pos+length)
export function deleteRange(pt: PieceTable, pos: number, length: number): void {
  if (length <= 0) return
  if (pos < 0 || pos + length > getLength(pt)) throw new Error('Out of range')

  let offset = 0
  for (let i = 0; i < pt.pieces.length && length > 0; ) {
    const p = pt.pieces[i]
    const startInPiece = Math.max(0, pos - offset)
    const endInPiece = Math.min(p.length, pos + length - offset)
    const deleteCount = endInPiece - startInPiece

    if (deleteCount > 0) {
      if (deleteCount === p.length) {
        // Remove whole piece
        pt.pieces.splice(i, 1)
      } else if (startInPiece === 0) {
        // Chop from start
        p.start += deleteCount
        p.length -= deleteCount
        i++
      } else if (endInPiece === p.length) {
        // Chop from end
        p.length -= deleteCount
        i++
      } else {
        // Split into left + right, drop middle
        const left: Piece = {
          buffer: p.buffer,
          start: p.start,
          length: startInPiece,
        }
        const right: Piece = {
          buffer: p.buffer,
          start: p.start + endInPiece,
          length: p.length - endInPiece,
        }
        pt.pieces.splice(i, 1, left, right)
        i += 2
      }
      pos += deleteCount
      length -= deleteCount
      offset += deleteCount // move past deleted segment
    } else {
      offset += p.length
      i++
    }
  }
}
