import { PieceTable } from './piece-table'

// The grid has `columns` cells per row for content, plus one extra (hidden)
// cell at col === columns which holds the newline character (if any).
//
// Positions in the document are absolute character offsets. Grid points
// are caret positions, i.e. `col` is the gap *before* cell `col`, so
// valid caret columns are 0..columns (inclusive).

export interface Cell {
  content: string
  row: number
  col: number
  // absolute character offset, -1 for padding
  index: number
  // piece the character belongs to, -1 for padding (used for debugging)
  pieceIndex: number
  // how many cells past the end of the line this padding cell is
  virtual: number
}

export interface Line {
  // absolute offset of the first character on the row
  start: number
  // absolute offset after the last (non-newline) character on the row
  end: number
  // whether the row is terminated by a '\n' (located at offset `end`)
  newline: boolean
}

export interface Layout {
  columns: number
  length: number
  lines: Line[]
  rows: Cell[][]
}

// When a position sits exactly on a soft wrap it could be drawn either at the
// end of the upper row or at the start of the lower row.
// 'upstream' => end of the upper row, 'downstream' => start of the lower row
export type Affinity = 'upstream' | 'downstream'

export interface Position {
  index: number
  // number of empty cells past the end of the line (only meaningful when
  // `index` is at the end of a line)
  virtual: number
  affinity: Affinity
}

export interface GridPoint {
  row: number
  col: number
}

export function buildLayout(pt: PieceTable, columns: number): Layout {
  columns = Math.max(1, columns)
  const lines: Line[] = []
  const rows: Cell[][] = []

  let index = 0
  let lineStart = 0
  let row: Cell[] = []

  const closeLine = (end: number, newline: Cell | null) => {
    lines.push({ start: lineStart, end, newline: newline !== null })
    const len = row.length
    for (let col = len; col < columns; col++) {
      row.push(padding(rows.length, col, col - len))
    }
    row.push(newline ?? padding(rows.length, columns, columns - len))
    rows.push(row)
    row = []
  }

  for (let i = 0; i < pt.pieces.length; i++) {
    const piece = pt.pieces[i]
    const buffer = piece.buffer === 'original' ? pt.original : pt.add

    for (let j = 0; j < piece.length; j++) {
      const ch = buffer[piece.start + j]

      if (ch === '\n') {
        closeLine(index, {
          content: '␍',
          row: rows.length,
          col: columns,
          index,
          pieceIndex: i,
          virtual: 0,
        })
        lineStart = index + 1
      } else {
        if (row.length === columns) {
          // soft wrap
          closeLine(index, null)
          lineStart = index
        }
        row.push({
          content: ch,
          row: rows.length,
          col: row.length,
          index,
          pieceIndex: i,
          virtual: 0,
        })
      }
      index++
    }
  }

  // the last line is always open (it is empty if the document is empty or ends with '\n')
  closeLine(index, null)

  return { columns, length: index, lines, rows }
}

function padding(row: number, col: number, virtual: number): Cell {
  return { content: '', row, col, index: -1, pieceIndex: -1, virtual }
}

let cache: { pt: PieceTable; columns: number; layout: Layout } | null = null

// Memoised by piece table identity, since piece tables are replaced (never
// mutated) once they are committed to the store
export function getLayout(pt: PieceTable, columns: number): Layout {
  if (cache && cache.pt === pt && cache.columns === columns) return cache.layout
  const layout = buildLayout(pt, columns)
  cache = { pt, columns, layout }
  return layout
}

// Index of the row containing `index`, honouring affinity on soft wraps
function findRow(layout: Layout, index: number, affinity: Affinity) {
  const { lines } = layout
  // binary search for the first line whose end >= index
  let lo = 0
  let hi = lines.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].end < index) lo = mid + 1
    else hi = mid
  }

  const line = lines[lo]
  if (
    affinity === 'downstream' &&
    line.end === index &&
    !line.newline &&
    lo + 1 < lines.length
  ) {
    return lo + 1
  }
  return lo
}

export function positionToGrid(layout: Layout, pos: Position): GridPoint {
  const index = clamp(pos.index, 0, layout.length)
  const row = findRow(layout, index, pos.affinity)
  const line = layout.lines[row]
  const virtual = index === line.end ? pos.virtual : 0
  const col = Math.min(index - line.start + virtual, layout.columns)
  return { row, col }
}

export function gridToPosition(
  layout: Layout,
  row: number,
  col: number,
): Position {
  row = clamp(row, 0, layout.lines.length - 1)
  col = clamp(col, 0, layout.columns)
  const line = layout.lines[row]
  const len = line.end - line.start
  const affinity: Affinity = col === 0 ? 'downstream' : 'upstream'

  if (col <= len) return { index: line.start + col, virtual: 0, affinity }
  return { index: line.end, virtual: col - len, affinity }
}

// Snaps a position (which may have been created under a different layout) to
// a valid position in this layout
export function normalisePosition(layout: Layout, pos: Position): Position {
  const { row, col } = positionToGrid(layout, pos)
  return gridToPosition(layout, row, col)
}

export function comparePositions(a: Position, b: Position) {
  return a.index - b.index || a.virtual - b.virtual
}

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max)
}
