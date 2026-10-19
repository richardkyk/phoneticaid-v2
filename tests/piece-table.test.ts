import { describe, it, expect } from 'vitest'
import {
  deleteRange,
  getText,
  insertText,
  PieceTable,
  textLength,
} from '@/lib/piece-table'

function makePT(...parts: string[]): PieceTable {
  const pt: PieceTable = { original: '', add: '', pieces: [] }
  parts.forEach((part, i) => {
    const buffer = i === 0 ? 'original' : 'add'
    const start = buffer === 'original' ? pt.original.length : pt.add.length
    if (buffer === 'original') pt.original += part
    else pt.add += part
    pt.pieces.push({ buffer, start, length: part.length })
  })
  return pt
}

// deterministic PRNG so failures are reproducible
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

describe('getText', () => {
  it('returns the whole document', () => {
    expect(getText(makePT('abc', '\n12', 'xy'))).toBe('abc\n12xy')
  })

  it('returns slices spanning pieces', () => {
    const pt = makePT('abc', '\n12', 'xy')
    expect(getText(pt, 2, 7)).toBe('c\n12x')
    expect(getText(pt, 3, 3)).toBe('')
    expect(getText(pt, 7, 2)).toBe('c\n12x')
    expect(getText(pt, 6, 100)).toBe('xy')
  })

  it('handles an empty table', () => {
    expect(getText(makePT())).toBe('')
    expect(textLength(makePT())).toBe(0)
  })
})

describe('insertText', () => {
  it('inserts into an empty table', () => {
    const pt = makePT()
    insertText(pt, 0, 'hi')
    expect(getText(pt)).toBe('hi')
  })

  it('inserts at the start, middle, piece boundary and end', () => {
    const pt = makePT('hello', 'world')
    insertText(pt, 0, '<')
    insertText(pt, 3, '-')
    insertText(pt, 7, '|')
    insertText(pt, textLength(pt), '>')
    expect(getText(pt)).toBe('<he-llo|world>')
  })

  it('clamps out of range offsets', () => {
    const pt = makePT('abc')
    insertText(pt, 99, 'z')
    insertText(pt, -5, 'a')
    expect(getText(pt)).toBe('aabcz')
  })
})

describe('deleteRange', () => {
  it('deletes within a piece', () => {
    const pt = makePT('hello')
    deleteRange(pt, 1, 3)
    expect(getText(pt)).toBe('hlo')
  })

  it('deletes across pieces', () => {
    const pt = makePT('abc', 'def', 'ghi')
    deleteRange(pt, 2, 7)
    expect(getText(pt)).toBe('abhi')
  })

  it('does nothing for an empty range', () => {
    const pt = makePT('abc')
    deleteRange(pt, 1, 1)
    expect(getText(pt)).toBe('abc')
  })

  it('deletes everything', () => {
    const pt = makePT('abc', 'def')
    deleteRange(pt, 0, 6)
    expect(getText(pt)).toBe('')
    expect(pt.pieces).toEqual([])
  })
})

describe('random edits match a plain string', () => {
  it.each([1, 2, 3, 4, 5])('seed %i', (seed) => {
    const random = rng(seed)
    const pt = makePT('the quick\nbrown fox')
    let expected = 'the quick\nbrown fox'

    for (let i = 0; i < 500; i++) {
      const a = Math.floor(random() * (expected.length + 1))
      if (random() < 0.6) {
        const text = 'xyz\n'.slice(0, 1 + Math.floor(random() * 4))
        insertText(pt, a, text)
        expected = expected.slice(0, a) + text + expected.slice(a)
      } else {
        const b = Math.floor(random() * (expected.length + 1))
        deleteRange(pt, a, b)
        const [s, e] = a < b ? [a, b] : [b, a]
        expected = expected.slice(0, s) + expected.slice(e)
      }
      expect(getText(pt)).toBe(expected)
      expect(pt.pieces.every((p) => p.length > 0)).toBe(true)

      const s = Math.floor(random() * (expected.length + 1))
      const e = Math.floor(random() * (expected.length + 1))
      expect(getText(pt, s, e)).toBe(
        expected.slice(Math.min(s, e), Math.max(s, e)),
      )
    }
  })
})
