import { PieceTable } from './piece-table'
import { DocumentState } from './stores/document-store'

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
  offset: number
}

export function buildRows(pt: PieceTable, document: DocumentState) {
  const rows: Cell[][] = []
  let row: Cell[] = []
  let last: null | Cell = null
  let rowCount = 0

  const pieceMap = new Map<string, string>()
  const gridMap = new Map<string, string>()

  for (const { row: r, col: c, ch, pieceIndex, charIndex } of walkPieces(
    pt,
    document,
  )) {
    const isNewLine = ch === '\n'
    const pieceKey = `${pieceIndex}:${charIndex}`
    const gridKey = `${r}:${isNewLine ? document.columns : c}`
    pieceMap.set(pieceKey, `${gridKey}:${isNewLine ? 1 : 0}`)
    gridMap.set(gridKey, `${pieceKey}:${isNewLine ? 1 : 0}`)

    if (last && r > last.row) {
      const paddedRow = padRow(row, last.row, document)
      rows.push(paddedRow)
      row = []
    }

    const cell = makeCell(
      r,
      isNewLine ? document.columns : c,
      isNewLine ? '␍' : ch,
      pieceIndex,
      charIndex,
      isNewLine && last ? document.columns - last.col : 0,
      document,
    )

    if (isNewLine) {
      const paddedRow = padRow(row, r, document)
      paddedRow[paddedRow.length - 1] = cell
      row = paddedRow
    } else {
      row.push(cell)
    }

    last = cell
  }

  rowCount = last?.row ? last.row + 1 : 1

  // flush remaining row
  if (last && row.length > 0) {
    rows.push(padRow(row, last.row, document))
  }

  if (last && last.content === '␍') {
    // special case: document ends with newline → add an empty padded row
    rows.push(padRow([], last.row + 1, document))
    rowCount++
  }

  // special case when the document is empty
  if (rows.length === 0) {
    rows.push(padRow([], 0, document))
  }

  return {
    rows,
    pieceMap,
    gridMap,
    rowCount,
  }
}

export function* walkPieces(
  pt: PieceTable,
  document: DocumentState,
  initial?: { row: number; col: number; pieceIndex: number; charIndex: number },
) {
  let row = initial?.row ?? 0
  let col = initial?.col ?? 0

  for (let i = initial?.pieceIndex ?? 0; i < pt.pieces.length; i++) {
    const piece = pt.pieces[i]
    const buffer = piece.buffer === 'original' ? pt.original : pt.add

    for (let j = initial?.charIndex ?? 0; j < piece.length; j++) {
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
  offset: number,
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
    offset,
    width: document.fontSize,
    height: document.fontSize,
  }
}

function padRow(row: Cell[], line: number, document: DocumentState) {
  let offset = 1
  while (row.length <= document.columns) {
    const cell = makeCell(line, row.length, '', -1, -1, offset, document)
    row.push(cell)
    offset++
  }
  return row
}
