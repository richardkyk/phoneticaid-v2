import { getPieceIndex, insertAtRowCol, PieceTable } from '@/lib/piece-table'
import { useDocumentStore } from '@/lib/store'
import { describe, it, expect, beforeEach } from 'vitest'

// Small helper for tests
function makePT(original: string, add: string): PieceTable {
  return {
    original,
    add,
    pieces: [
      { buffer: 'original', start: 0, length: original.length },
      { buffer: 'add', start: 0, length: add.length },
    ],
  }
}

const document = useDocumentStore.getState()

describe('getPieceIndex', () => {
  beforeEach(() => {
    document.columns = 17
  })

  it('returns the correct values', () => {
    const pt = makePT('abc', '1x3')
    const res = getPieceIndex(pt, 0, 4, document)
    expect(res.pieceIndex).toBe(1)
    expect(res.offsetInPiece).toBe(1)
  })

  it('handles newline correctly', () => {
    const pt = makePT('abc', '\n1x3')
    const res = getPieceIndex(pt, 1, 1, document)
    expect(res.pieceIndex).toBe(1)
    expect(res.offsetInPiece).toBe(2)
  })

  it('handles multiple newlines correctly', () => {
    const pt = makePT('a\nbc\n', '\n\n1x3')
    const res = getPieceIndex(pt, 4, 1, document)
    expect(res.pieceIndex).toBe(1)
    expect(res.offsetInPiece).toBe(3)
  })

  it('handles word wrapping correctly', () => {
    document.columns = 3
    const pt = makePT('abc\ndef', '123')
    const res = getPieceIndex(pt, 0, 3, document)
    expect(res.pieceIndex).toBe(0)
    expect(res.offsetInPiece).toBe(3)
  })

  it('handles space correctly', () => {
    const pt = makePT('abc', ' 1x3')
    const res = getPieceIndex(pt, 0, 5, document)
    expect(res.pieceIndex).toBe(1)
    expect(res.offsetInPiece).toBe(2)
  })

  it('handles multiple spaces correctly', () => {
    const pt = makePT('a bc', '   1 x3')
    const res = getPieceIndex(pt, 0, 9, document)
    expect(res.pieceIndex).toBe(1)
    expect(res.offsetInPiece).toBe(5)
  })

  it('should show index at the end of array', () => {
    const pt = makePT('abc', '1x3')
    const res = getPieceIndex(pt, 1, 5, document)
    expect(res.pieceIndex).toBe(2)
    expect(res.offsetInPiece).toBe(0)
  })

  it('handles wrapping correctly', () => {
    document.columns = 2
    const pt = makePT('abc', '1x3')
    const res = getPieceIndex(pt, 2, 0, document)
    expect(res.pieceIndex).toBe(1)
    expect(res.offsetInPiece).toBe(1)
  })

  it('handles wrapping with newlines correctly', () => {
    document.columns = 2
    const pt = makePT('ab\nc', '\n1x3')
    const res = getPieceIndex(pt, 2, 1, document)
    expect(res.pieceIndex).toBe(1)
    expect(res.offsetInPiece).toBe(2)
  })

  it('handles wrapping with mutliple newlines correctly', () => {
    document.columns = 2
    const pt = makePT('ab\nc', '\n\n1x3')
    const res = getPieceIndex(pt, 3, 1, document)
    expect(res.pieceIndex).toBe(1)
    expect(res.offsetInPiece).toBe(3)
  })
})

describe('PieceTable insert', () => {
  let pt: PieceTable

  beforeEach(() => {
    pt = {
      original: 'hello\nworld',
      add: '',
      pieces: [{ buffer: 'original', start: 0, length: 11 }],
    }
    document.columns = 5
  })

  it('inserts text in the middle of a piece', () => {
    // heXXl
    // lo
    // world
    const cursor = insertAtRowCol(pt, 0, 2, 'XX', document)
    expect(pt.add).toBe('XX')
    expect(pt.pieces.length).toBe(3) // left + new + right
    expect(cursor).toEqual({ curRow: 0, curCol: 4 })
  })

  it('inserts text at the end of a row', () => {
    // hello
    // XX
    // world
    console.log(pt)
    const cursor = insertAtRowCol(pt, 0, 5, 'XX', document)
    expect(pt.add).toBe('XX')
    expect(cursor).toEqual({ curRow: 1, curCol: 2 })
  })
})
