// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { getText } from '@/lib/piece-table'
import { positionToGrid } from '@/lib/layout'
import { currentLayout, useCursorStore } from '@/lib/stores/cursor-store'
import { useDocumentStore } from '@/lib/stores/document-store'
import { useHistoryStore } from '@/lib/stores/history-store'
import { usePieceTableStore } from '@/lib/stores/piece-table-store'
import { useProjectsStore } from '@/lib/stores/projects-store'

const cursor = () => useCursorStore.getState()
const editor = () => usePieceTableStore.getState()
const history = () => useHistoryStore.getState()

function load(text: string, columns: number) {
  useProjectsStore.getState().getActiveProject()
  useProjectsStore.getState().setActiveProjectAttribute({
    pt: {
      original: text,
      add: '',
      pieces: text.length
        ? [{ buffer: 'original', start: 0, length: text.length }]
        : [],
    },
  })
  useDocumentStore.getState().setColumns(columns)
  cursor().reset()
  history().reset()
}

const text = () => getText(useProjectsStore.getState().getActiveProject().pt)
const caret = () => positionToGrid(currentLayout(), cursor().getPosition())
const click = (row: number, col: number) => cursor().setCursorByRowCol(row, col)
const select = (from: [number, number], to: [number, number]) => {
  cursor().setSelection(...from, true)
  cursor().setSelection(...to, false)
  click(...to)
}
const type = (s: string) => {
  for (const ch of s) editor().insertAtCursor(ch)
}
const backspace = () => editor().deleteAtCursor(1)
const setColumns = (columns: number) =>
  useDocumentStore.getState().setColumns(columns)

// '·' is padding, '⏎' marks a newline cell
const draw = () => {
  const layout = currentLayout()
  return layout.rows.map(
    (row) =>
      row
        .slice(0, layout.columns)
        .map((c) => c.content || '·')
        .join('') + (row[layout.columns].content === '␍' ? '⏎' : ''),
  )
}

describe('typing', () => {
  beforeEach(() => load('', 3))

  it('wraps onto the next row', () => {
    type('abc')
    expect(caret()).toEqual({ row: 0, col: 3 })
    type('d')
    expect(draw()).toEqual(['abc', 'd··'])
    expect(caret()).toEqual({ row: 1, col: 1 })
  })

  it('inserts in the middle of text', () => {
    load('abcdef', 3)
    click(1, 0)
    type('X')
    expect(text()).toBe('abcXdef')
    expect(caret()).toEqual({ row: 1, col: 1 })
  })

  it('fills the gap with spaces when typing in padding', () => {
    load('ab', 5)
    click(0, 4)
    type('X')
    expect(text()).toBe('ab  X')
    expect(caret()).toEqual({ row: 0, col: 5 })
  })

  it('typing in the newline column continues on the next row', () => {
    load('ab\ncd', 4)
    click(0, 4)
    type('X')
    // the gap is filled with real spaces
    expect(draw()).toEqual(['ab  ', 'X···⏎', 'cd··'])
    expect(caret()).toEqual({ row: 1, col: 1 })
  })

  it('enter in padding breaks the line where the text ends', () => {
    load('ab\ncd', 5)
    click(0, 4)
    type('\n')
    expect(text()).toBe('ab\n\ncd')
    expect(caret()).toEqual({ row: 1, col: 0 })
  })

  it('normalises windows line endings when pasting', () => {
    load('', 5)
    editor().insertAtCursor('a\r\nb')
    expect(text()).toBe('a\nb')
  })
})

describe('backspace', () => {
  it('deletes the previous character across a soft wrap', () => {
    load('abcdef', 3)
    click(1, 0)
    backspace()
    expect(text()).toBe('abdef')
    expect(caret()).toEqual({ row: 0, col: 2 })
  })

  it('keeps the caret on the row when deleting the first character of it', () => {
    load('abcdef', 3)
    click(1, 1)
    backspace()
    expect(text()).toBe('abcef')
    expect(caret()).toEqual({ row: 1, col: 0 })
  })

  it('joins lines', () => {
    load('ab\ncd', 5)
    click(1, 0)
    backspace()
    expect(text()).toBe('abcd')
    expect(caret()).toEqual({ row: 0, col: 2 })
  })

  it('moves back through padding without deleting', () => {
    load('ab', 5)
    click(0, 4)
    backspace()
    expect(text()).toBe('ab')
    expect(caret()).toEqual({ row: 0, col: 3 })
  })

  it('does nothing at the start of the document', () => {
    load('ab', 5)
    click(0, 0)
    backspace()
    expect(text()).toBe('ab')
  })
})

describe('selection', () => {
  it('extracts and deletes across a soft wrap', () => {
    load('abcdef', 3)
    select([0, 2], [1, 1])
    expect(editor().extractSelection()).toBe('cd')
    backspace()
    expect(text()).toBe('abef')
    expect(caret()).toEqual({ row: 0, col: 2 })
    expect(cursor().getSelection()).toBeNull()
  })

  it('selections are order independent', () => {
    load('abcdef', 3)
    select([1, 1], [0, 2])
    expect(editor().extractSelection()).toBe('cd')
  })

  it('typing over a selection starting in padding keeps the visual position', () => {
    load('ab\ncd', 6)
    select([0, 4], [1, 1])
    expect(editor().extractSelection()).toBe('\nc')
    type('X')
    expect(text()).toBe('ab  Xd')
    expect(caret()).toEqual({ row: 0, col: 5 })
  })

  it('deleting a selection of only padding does nothing', () => {
    load('ab\ncd', 6)
    select([0, 3], [0, 5])
    expect(editor().extractSelection()).toBe('')
    backspace()
    expect(text()).toBe('ab\ncd')
    expect(caret()).toEqual({ row: 0, col: 3 })
  })

  it('select all and delete', () => {
    load('abc\ndef\nghi', 2)
    cursor().selectAll()
    expect(editor().extractSelection()).toBe('abc\ndef\nghi')
    backspace()
    expect(text()).toBe('')
    expect(caret()).toEqual({ row: 0, col: 0 })
  })

  it('survives a layout change', () => {
    load('abcdef', 6)
    select([0, 1], [0, 4])
    setColumns(2)
    expect(editor().extractSelection()).toBe('bcd')
    type('X')
    expect(text()).toBe('aXef')
  })
})

describe('layout changes', () => {
  it('keeps the caret on the same character', () => {
    load('abcdefgh', 8)
    click(0, 5)
    setColumns(3)
    expect(caret()).toEqual({ row: 1, col: 2 })
    type('X')
    expect(text()).toBe('abcdeXfgh')
  })

  it('keeps the caret in padding and restores it when growing again', () => {
    load('abcdef\nxyz', 10)
    click(0, 8)
    setColumns(4)
    expect(draw()).toEqual(['abcd', 'ef··⏎', 'xyz·'])
    expect(caret()).toEqual({ row: 1, col: 4 })
    setColumns(10)
    expect(caret()).toEqual({ row: 0, col: 8 })
  })

  it('types where the caret is drawn after shrinking', () => {
    load('abcdef\nxyz', 10)
    click(0, 8)
    setColumns(4)
    backspace() // moves from col 4 to col 3 in the padding
    type('X')
    expect(draw()).toEqual(['abcd', 'ef X⏎', 'xyz·'])
  })

  it('keeps the caret after typing then shrinking', () => {
    load('abcdefgh', 10)
    click(0, 3)
    type('XY')
    setColumns(3)
    type('Z')
    expect(text()).toBe('abcXYZdefgh')
  })
})

describe('cursor movement', () => {
  beforeEach(() => load('abcdef\nxy', 3))
  // abc
  // def⏎
  // xy·

  it('arrow right goes through the newline column onto the next row', () => {
    click(0, 2)
    cursor().moveCursor('nextChar')
    expect(caret()).toEqual({ row: 0, col: 3 })
    cursor().moveCursor('nextChar')
    expect(caret()).toEqual({ row: 1, col: 0 })
  })

  it('arrow left goes to the end of the previous row', () => {
    click(2, 0)
    cursor().moveCursor('prevChar')
    expect(caret()).toEqual({ row: 1, col: 3 })
  })

  it('up and down keep the column, including in padding', () => {
    click(0, 3)
    cursor().moveCursor('nextLine')
    cursor().moveCursor('nextLine')
    expect(caret()).toEqual({ row: 2, col: 3 })
    cursor().moveCursor('nextLine')
    expect(caret()).toEqual({ row: 2, col: 3 })
    cursor().moveCursor('prevLine')
    expect(caret()).toEqual({ row: 1, col: 3 })
  })

  it('home and end', () => {
    click(1, 1)
    cursor().moveCursor('lineEnd')
    expect(caret()).toEqual({ row: 1, col: 3 })
    cursor().moveCursor('lineStart')
    expect(caret()).toEqual({ row: 1, col: 0 })
  })
})

describe('history', () => {
  it('undo and redo restore text and caret', () => {
    load('abc', 5)
    click(0, 1)
    type('X')
    expect(text()).toBe('aXbc')
    history().undo()
    expect(text()).toBe('abc')
    expect(caret()).toEqual({ row: 0, col: 1 })
    history().redo()
    expect(text()).toBe('aXbc')
    expect(caret()).toEqual({ row: 0, col: 2 })
  })

  it('undo restores the caret under a different layout', () => {
    load('abcdef', 6)
    click(0, 4)
    type('X')
    setColumns(2)
    history().undo()
    expect(text()).toBe('abcdef')
    // after 'd', which is now at the end of the second row
    expect(caret()).toEqual({ row: 1, col: 2 })
  })
})

// deterministic PRNG so failures are reproducible
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

describe('random editing sessions', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])('seed %i', (seed) => {
    const random = rng(seed)
    const int = (n: number) => Math.floor(random() * n)
    load('你好\n世界abc\n\nxyz', 4)
    let historyLength = 0
    let lastEdit = cursor().getPosition()

    for (let step = 0; step < 300; step++) {
      const layout = currentLayout()
      const columns = layout.columns
      const rows = layout.lines.length
      const op = random()
      const ctx = `seed ${seed} step ${step} op ${op.toFixed(2)} ${JSON.stringify(text())} cols ${columns} caret ${JSON.stringify(caret())} pos ${JSON.stringify(cursor().getPosition())}`

      if (op < 0.25) {
        const row = int(rows)
        const col = int(columns + 1)
        click(row, col)
        expect(caret(), ctx).toEqual({ row, col })
      } else if (op < 0.55) {
        // typed characters appear exactly where the caret is drawn
        cursor().resetSelection()
        const { row, col } = caret()
        type('字')
        const at = col < columns ? { row, col } : { row: row + 1, col: 0 }
        expect(currentLayout().rows[at.row][at.col].content, ctx).toBe('字')
        expect(caret(), ctx).toEqual({ row: at.row, col: at.col + 1 })
      } else if (op < 0.65) {
        cursor().resetSelection()
        const before = text()
        const pos = cursor().getPosition()
        const { row, col } = caret()
        backspace()
        const line = layout.lines[row]
        if (col > line.end - line.start) {
          // in padding: move back a cell
          expect(text(), ctx).toBe(before)
          expect(caret(), ctx).toEqual({ row, col: col - 1 })
        } else if (pos.index > 0) {
          expect(text(), ctx).toBe(
            before.slice(0, pos.index - 1) + before.slice(pos.index),
          )
        }
      } else if (op < 0.7) {
        type('\n')
      } else if (op < 0.8) {
        const before = text()
        const from: [number, number] = [int(rows), int(columns + 1)]
        const to: [number, number] = [int(rows), int(columns + 1)]
        select(from, to)
        const selected = editor().extractSelection()
        const a = currentLayout()
        const startIndex = Math.min(
          ...[from, to].map(([r, c]) =>
            Math.min(a.lines[r].start + c, a.lines[r].end),
          ),
        )
        expect(
          before.slice(startIndex, startIndex + selected.length),
          ctx,
        ).toBe(selected)
        backspace()
        if (selected.length > 0) {
          expect(text(), ctx).toBe(
            before.slice(0, startIndex) +
              before.slice(startIndex + selected.length),
          )
        }
      } else if (op < 0.9) {
        const index = cursor().index
        const virtual = cursor().virtual
        setColumns(1 + int(8))
        if (virtual === 0) expect(cursor().index, ctx).toBe(index)
      } else {
        // undo then redo restores the text and the caret from right after the edit
        const before = text()
        if (history().past.length === 0) continue
        history().undo()
        history().redo()
        expect(text(), ctx).toBe(before)
        expect(cursor().getPosition(), ctx).toEqual(lastEdit)
      }

      if (history().past.length !== historyLength) {
        historyLength = history().past.length
        lastEdit = cursor().getPosition()
      }

      // invariants
      const { row, col } = caret()
      expect(row, ctx).toBeLessThan(currentLayout().lines.length)
      expect(col, ctx).toBeLessThanOrEqual(currentLayout().columns)
    }
  })
})

describe('per-project history', () => {
  it('keeps each project its own undo stack', () => {
    const projects = () => useProjectsStore.getState()
    const a = projects().getActiveProject()
    load('', 5)
    type('A')

    const b = projects().addProject()
    type('B')
    expect(text()).toBe('B')

    projects().setActiveProject(a.id)
    expect(text()).toBe('A')
    history().undo()
    expect(text()).toBe('')

    projects().setActiveProject(b.id)
    expect(history().past.length).toBe(1)
    history().undo()
    expect(text()).toBe('')

    // back on the first project, redo still works
    projects().setActiveProject(a.id)
    history().redo()
    expect(text()).toBe('A')
  })

  it('deleting another project keeps the active one', () => {
    const projects = () => useProjectsStore.getState()
    const a = projects().getActiveProject()
    const b = projects().addProject()
    projects().setActiveProject(a.id)
    projects().deleteProject(b.id)
    expect(projects().activeId).toBe(a.id)
  })
})
