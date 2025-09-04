import { PieceTable } from './piece-table'
import { DocumentState } from './store'

interface Cell {
  content: string
  x: number
  y: number
  width: number
  height: number
}

export function buildRows(pt: PieceTable, document: DocumentState): Cell[][] {
  const rows: Cell[][] = []
  let row: Cell[] = []
  let col = 0
  let line = 0
  let wasJustWrapped = false

  for (const piece of pt.pieces) {
    const buffer = piece.buffer === 'original' ? pt.original : pt.add
    for (let i = 0; i < piece.length; i++) {
      const ch = buffer[piece.start + i]

      const cell = makeCell(line, col, ch, document)
      if (ch !== '\n') row.push(cell)
      col++

      if (ch === '\n' || col >= document.columns) {
        const _row = padRow(row, line, document)
        if (_row) rows.push(_row)

        if (ch === '\n') {
          if (!wasJustWrapped) line++
          wasJustWrapped = false
        } else {
          line++
          wasJustWrapped = true
        }

        row = []
        col = 0
        continue
      }
      wasJustWrapped = false
    }
  }

  // need to commit the last row if it doesn't end with a newline/wrap
  const _row = padRow(row, line, document)
  if (_row) rows.push(_row)

  return rows
}

function makeCell(
  row: number,
  col: number,
  content: string,
  document: DocumentState,
) {
  return {
    content,
    x: col * (document.fontSize + document.gapX) + document.marginX,
    y: row * (document.fontSize + document.gapY) + document.marginY,
    width: document.fontSize,
    height: document.fontSize,
  }
}

function padRow(row: Cell[], line: number, document: DocumentState) {
  if (row.length === 0) return

  while (row.length < document.columns) {
    const cell = makeCell(line, row.length, '', document)
    row.push(cell)
  }
  return row
}
