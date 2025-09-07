import { PieceTable } from './piece-table'
import { DocumentState } from './store'

interface Cell {
  content: string
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
  let lastRowNumber = 0
  let lastChar = ''

  for (const { row: r, col: c, ch, pieceIndex, charIndex } of walkPieces(
    pt,
    document,
  )) {
    const cell = makeCell(r, c, ch, pieceIndex, charIndex, document)
    if (ch !== '\n') row.push(cell)

    // commit row on newline or column wrap
    if (ch === '\n' || c === document.columns - 1) {
      rows.push(padRow(row, r, document))
      row = []
    }

    lastRowNumber = r
    lastChar = ch
  }

  // commit remaining row (that didn't end with newline or wrap, which didn't commit this row)
  if (row.length > 0) {
    rows.push(padRow(row, lastRowNumber, document))
  }

  // special case when a newline character is added to the end of the document
  if (lastChar === '\n') {
    rows.push(padRow(row, lastRowNumber + 1, document))
  }

  return rows
}

export function* walkPieces(pt: PieceTable, document: DocumentState) {
  let row = 0
  let col = 0
  let wasJustWrapped = false

  for (let i = 0; i < pt.pieces.length; i++) {
    const piece = pt.pieces[i]
    const buffer = piece.buffer === 'original' ? pt.original : pt.add

    for (let j = 0; j < piece.length; j++) {
      const ch = buffer[piece.start + j]

      // Yield current visual position
      yield {
        row,
        col,
        ch,
        pieceIndex: i,
        charIndex: j,
      }

      col++

      if (ch === '\n' || col >= document.columns) {
        if (ch === '\n' && wasJustWrapped) {
          // Do not increment row again
          col = 0
        } else {
          row++
          col = 0
        }
        wasJustWrapped = ch !== '\n'
      } else {
        wasJustWrapped = false
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
    x: col * (document.fontSize + document.gapX) + document.marginX,
    y: row * (document.fontSize + document.gapY) + document.marginY,
    pieceIndex,
    charIndex,
    width: document.fontSize,
    height: document.fontSize,
  }
}

function padRow(row: Cell[], line: number, document: DocumentState) {
  while (row.length < document.columns) {
    const cell = makeCell(line, row.length, '', -1, -1, document)
    row.push(cell)
  }
  return row
}
