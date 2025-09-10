import { PieceTable } from './piece-table'
import { DocumentState, useRowsStore } from './store'

interface Cell {
  content: string
  row: number
  col: number
  x: number
  y: number
  pieceIndex: number
  charIndex: number
  width: number
  height: number
}

export function buildRows(pt: PieceTable, document: DocumentState): Cell[][] {
  const rows: Cell[][] = []
  let row: Cell[] = []
  let last: null | Cell = null

  for (const { row: r, col: c, ch, pieceIndex, charIndex } of walkPieces(
    pt,
    document,
  )) {
    console.log(`[${pieceIndex}][${charIndex}]=${ch} -> (${r},${c}) `)

    if (last && r > last.row) {
      const paddedRow = padRow(row, last.row, document)
      if (last.content === '\n') {
        const newLineCell = makeCell(
          last.row,
          document.columns,
          '␍',
          last.pieceIndex,
          last.charIndex,
          document,
        )
        paddedRow[paddedRow.length - 1] = newLineCell
      }
      rows.push(paddedRow)
      row = []
    }
    const cell = makeCell(r, c, ch, pieceIndex, charIndex, document)
    if (cell.content !== '\n') row.push(cell)

    last = cell
  }

  // flush remaining row (that didn't end with newline or wrap, which didn't commit this row)
  if (last && row.length > 0) {
    rows.push(padRow(row, last.row, document))
    row = []
  }

  // special case when the document is empty
  if (rows.length === 0) {
    rows.push(padRow([], 0, document))
  }

  console.log(rows)
  useRowsStore.getState().setRows(rows.length)
  return rows
}

export function* walkPieces(pt: PieceTable, document: DocumentState) {
  let row = 0
  let col = 0

  for (let i = 0; i < pt.pieces.length; i++) {
    const piece = pt.pieces[i]
    const buffer = piece.buffer === 'original' ? pt.original : pt.add

    for (let j = 0; j < piece.length; j++) {
      const ch = buffer[piece.start + j]

      if (ch !== '\n' && col > document.columns - 1) {
        row++
        col = 0
      }

      yield {
        row,
        col,
        ch,
        pieceIndex: i,
        charIndex: j,
      }
      col++
      if (ch === '\n') {
        row++
        col = 0
      }
    }
  }
}

function makeCell(
  row: number,
  col: number,
  content: string,
  pieceIndex: number,
  charIndex: number,
  document: DocumentState,
) {
  return {
    content,
    row,
    col,
    x: col * (document.fontSize + document.gapX) + document.marginX,
    y: row * (document.fontSize + document.gapY) + document.marginY,
    pieceIndex,
    charIndex,
    width: document.fontSize,
    height: document.fontSize,
  }
}

function padRow(row: Cell[], line: number, document: DocumentState) {
  while (row.length <= document.columns) {
    const cell = makeCell(line, row.length, '', -1, -1, document)
    row.push(cell)
  }
  return row
}
