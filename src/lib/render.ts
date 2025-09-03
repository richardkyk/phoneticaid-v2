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
}

export function renderRow(
  rowOffset: number,
  row: Row,
  document: DocumentState,
): Cell[] {
  const cells: Cell[] = []
  let x = 0
  for (const piece of row.pieces) {
    const content =
      piece.type === 'original' ? row.originalBuffer : row.addBuffer

    cells.push({
      x: document.marginX + x * (document.gapX + document.fontSize),
      y: document.marginY + rowOffset * (document.gapY + document.fontSize),
      width: document.fontSize,
      height: document.fontSize,
      content: content.slice(piece.start, piece.start + piece.length),
    })
    x += piece.length || 1
  }
  return cells
}
