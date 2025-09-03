import { DocumentState } from './store'

interface Cell {
  x: number
  y: number
  width: number
  height: number
  content: string
}

export interface Row {
  pieces: Piece[]
  originalBuffer: string
  addBuffer: string
}

export interface Piece {
  type: 'original' | 'add'
  start: number
  length: number
  col: number
}

export function renderRow(
  rowOffset: number,
  row: Row,
  document: DocumentState,
): Cell[] {
  const cells = new Array(document.columns).fill(0).map((_, i) => {
    return {
      x: document.marginX + i * (document.gapX + document.fontSize),
      y: document.marginY + rowOffset * (document.gapY + document.fontSize),
      width: document.fontSize,
      height: document.fontSize,
      content: '',
    }
  })

  for (const piece of row.pieces) {
    const buffer =
      piece.type === 'original' ? row.originalBuffer : row.addBuffer

    const content = buffer.slice(piece.start, piece.start + piece.length)
    const col = piece.col

    for (let i = 0; i < content.length; i++) {
      const char = content[i]
      if (col + i < cells.length) {
        cells[col + i].content = char
      }
    }
  }
  return cells
}
