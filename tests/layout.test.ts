import { describe, it, expect } from 'vitest'
import {
  buildLayout,
  gridToPosition,
  Layout,
  normalisePosition,
  Position,
  positionToGrid,
} from '@/lib/layout'
import { PieceTable } from '@/lib/piece-table'

const pt = (text: string): PieceTable => ({
  original: text,
  add: '',
  pieces: text.length
    ? [{ buffer: 'original', start: 0, length: text.length }]
    : [],
})

// Renders the grid as strings: '·' is padding, '⏎' marks a newline cell
const draw = (layout: Layout) =>
  layout.rows.map(
    (row) =>
      row
        .slice(0, layout.columns)
        .map((c) => c.content || '·')
        .join('') + (row[layout.columns].content === '␍' ? '⏎' : ''),
  )

const pos = (
  index: number,
  virtual = 0,
  affinity: Position['affinity'] = 'upstream',
): Position => ({ index, virtual, affinity })

describe('buildLayout', () => {
  it('lays out an empty document as one empty row', () => {
    const layout = buildLayout(pt(''), 3)
    expect(draw(layout)).toEqual(['···'])
    expect(layout.lines).toEqual([{ start: 0, end: 0, newline: false }])
  })

  it('soft wraps long lines', () => {
    const layout = buildLayout(pt('abcdefg'), 3)
    expect(draw(layout)).toEqual(['abc', 'def', 'g··'])
    expect(layout.lines).toEqual([
      { start: 0, end: 3, newline: false },
      { start: 3, end: 6, newline: false },
      { start: 6, end: 7, newline: false },
    ])
  })

  it('does not add an empty row after an exactly full last row', () => {
    expect(draw(buildLayout(pt('abcdef'), 3))).toEqual(['abc', 'def'])
  })

  it('puts newlines in the extra column, even on a full row', () => {
    const layout = buildLayout(pt('abc\nd\n\ne'), 3)
    expect(draw(layout)).toEqual(['abc⏎', 'd··⏎', '···⏎', 'e··'])
    expect(layout.lines[0]).toEqual({ start: 0, end: 3, newline: true })
    expect(layout.lines[2]).toEqual({ start: 6, end: 6, newline: true })
  })

  it('adds an empty row when the document ends with a newline', () => {
    expect(draw(buildLayout(pt('ab\n'), 3))).toEqual(['ab·⏎', '···'])
  })

  it('records absolute offsets and padding distances on cells', () => {
    const layout = buildLayout(pt('ab\ncd'), 4)
    expect(layout.rows[1].map((c) => c.index)).toEqual([3, 4, -1, -1, -1])
    expect(layout.rows[1].map((c) => c.virtual)).toEqual([0, 0, 0, 1, 2])
    expect(layout.rows[0][4].index).toBe(2)
  })
})

describe('positionToGrid', () => {
  const layout = buildLayout(pt('abcdef\nxy'), 3)
  // abc
  // def⏎
  // xy·

  it('maps characters to their cells', () => {
    expect(positionToGrid(layout, pos(1))).toEqual({ row: 0, col: 1 })
    expect(positionToGrid(layout, pos(8))).toEqual({ row: 2, col: 1 })
    expect(positionToGrid(layout, pos(9))).toEqual({ row: 2, col: 2 })
  })

  it('uses affinity to resolve soft wraps', () => {
    expect(positionToGrid(layout, pos(3, 0, 'upstream'))).toEqual({
      row: 0,
      col: 3,
    })
    expect(positionToGrid(layout, pos(3, 0, 'downstream'))).toEqual({
      row: 1,
      col: 0,
    })
  })

  it('ignores affinity at hard line breaks', () => {
    expect(positionToGrid(layout, pos(6, 0, 'downstream'))).toEqual({
      row: 1,
      col: 3,
    })
    expect(positionToGrid(layout, pos(7, 0, 'upstream'))).toEqual({
      row: 2,
      col: 0,
    })
  })

  it('falls back to upstream when there is no next row', () => {
    const full = buildLayout(pt('abc'), 3)
    expect(positionToGrid(full, pos(3, 0, 'downstream'))).toEqual({
      row: 0,
      col: 3,
    })
  })

  it('places virtual positions past the end of the line, clamped to the row', () => {
    expect(positionToGrid(layout, pos(9, 1))).toEqual({ row: 2, col: 3 })
    expect(positionToGrid(layout, pos(9, 5))).toEqual({ row: 2, col: 3 })
  })

  it('clamps out of range indexes', () => {
    expect(positionToGrid(layout, pos(99))).toEqual({ row: 2, col: 2 })
    expect(positionToGrid(layout, pos(-1))).toEqual({ row: 0, col: 0 })
  })
})

describe('gridToPosition', () => {
  const layout = buildLayout(pt('abcdef\nxy'), 3)

  it('maps cells to characters', () => {
    expect(gridToPosition(layout, 0, 1)).toEqual(pos(1))
    expect(gridToPosition(layout, 1, 0)).toEqual(pos(3, 0, 'downstream'))
    expect(gridToPosition(layout, 0, 3)).toEqual(pos(3, 0, 'upstream'))
  })

  it('maps padding to the end of the line plus virtual cells', () => {
    expect(gridToPosition(layout, 2, 3)).toEqual(pos(9, 1))
  })

  it('clamps out of range points', () => {
    expect(gridToPosition(layout, 10, 10)).toEqual(pos(9, 1))
    expect(gridToPosition(layout, -1, -1)).toEqual(pos(0, 0, 'downstream'))
  })
})

describe('properties', () => {
  const docs = [
    '',
    'a',
    'abc',
    'abcdef',
    'abc\n',
    '\n\n\n',
    'ab\ncdefgh\n\nijklmnop\nq',
    '你好世界\n我是一个学生，我喜欢学习中文。\n\n再见',
  ]

  it('every grid point round trips through a position', () => {
    for (const text of docs) {
      for (let columns = 1; columns <= 8; columns++) {
        const layout = buildLayout(pt(text), columns)
        for (let row = 0; row < layout.lines.length; row++) {
          for (let col = 0; col <= columns; col++) {
            const p = gridToPosition(layout, row, col)
            expect(
              positionToGrid(layout, p),
              `${JSON.stringify(text)} ${columns} (${row},${col})`,
            ).toEqual({ row, col })
          }
        }
      }
    }
  })

  it('every offset is reachable and stays put across layouts', () => {
    for (const text of docs) {
      for (let a = 1; a <= 8; a++) {
        for (let b = 1; b <= 8; b++) {
          const layoutA = buildLayout(pt(text), a)
          const layoutB = buildLayout(pt(text), b)
          for (let index = 0; index <= text.length; index++) {
            for (const affinity of ['upstream', 'downstream'] as const) {
              const p = normalisePosition(layoutA, pos(index, 0, affinity))
              expect(p.index).toBe(index)
              expect(normalisePosition(layoutB, p).index).toBe(index)
            }
          }
        }
      }
    }
  })

  it('a character is drawn at the grid point of its position', () => {
    for (const text of docs) {
      for (let columns = 1; columns <= 8; columns++) {
        const layout = buildLayout(pt(text), columns)
        for (const row of layout.rows) {
          for (const cell of row) {
            // newlines live in the hidden column, the caret before them sits after the text
            if (cell.index === -1 || cell.content === '␍') continue
            expect(
              positionToGrid(layout, pos(cell.index, 0, 'downstream')),
            ).toEqual({
              row: cell.row,
              col: cell.col,
            })
          }
        }
      }
    }
  })
})
