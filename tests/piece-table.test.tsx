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
    // abc
    // 1x3
    const pt = makePT('abc', '1x3')
    const res = getPieceIndex(pt, 0, 4, document)
    expect(res.pieceIndex).toBe(1)
    expect(res.charIndex).toBe(1)
  })

  it('handles newline correctly', () => {
    //   abc
    // \n1x3
    const pt = makePT('abc', '\n1x3')
    const res = getPieceIndex(pt, 1, 1, document)
    expect(res.pieceIndex).toBe(1)
    expect(res.charIndex).toBe(2)
  })

  it('handles multiple newlines correctly', () => {
    //   a
    // \nbc
    // \n
    // \n
    // \n1x3
    const pt = makePT('a\nbc\n', '\n\n1x3')
    const res = getPieceIndex(pt, 4, 1, document)
    expect(res.pieceIndex).toBe(1)
    expect(res.charIndex).toBe(3)
  })

  it('handles word wrapping correctly 1', () => {
    document.columns = 3
    //   abc
    // \ndef
    //   123
    const pt = makePT('abc\ndef', '123')
    const res = getPieceIndex(pt, 0, 2, document)
    expect(res.pieceIndex).toBe(0)
    expect(res.charIndex).toBe(2)
    expect(res.isNewline).toBe(false)
  })

  it('handles word wrapping correctly 2', () => {
    document.columns = 3
    //   abc
    // \ndef
    //   123
    const pt = makePT('abc\ndef', '123')
    const res = getPieceIndex(pt, 0, 3, document)
    expect(res.pieceIndex).toBe(0)
    expect(res.charIndex).toBe(3)
    expect(res.isNewline).toBe(false)
  })

  it('handles word wrapping correctly 3', () => {
    document.columns = 3
    //   abc
    // \ndef
    //   123
    const pt = makePT('abc\ndef', '123')
    const res = getPieceIndex(pt, 1, 0, document)
    expect(res.pieceIndex).toBe(0)
    expect(res.charIndex).toBe(3)
    expect(res.isNewline).toBe(true)
  })

  it('handles virtual cells correctly', () => {
    //   abc__x
    // \ndef123
    const pt = makePT('abc\ndef', '123')
    const res = getPieceIndex(pt, 0, 5, document)
    expect(res.pieceIndex).toBe(0)
    expect(res.charIndex).toBe(3)
    expect(res.isNewline).toBe(true)
    expect(res.padding).toBe(2)
  })

  it('handles space correctly', () => {
    const pt = makePT('abc', ' 1x3')
    const res = getPieceIndex(pt, 0, 5, document)
    expect(res.pieceIndex).toBe(1)
    expect(res.charIndex).toBe(2)
  })

  it('handles multiple spaces correctly', () => {
    const pt = makePT('a bc', '   1 x3')
    const res = getPieceIndex(pt, 0, 9, document)
    expect(res.pieceIndex).toBe(1)
    expect(res.charIndex).toBe(5)
  })

  it('should show index at the end of array', () => {
    const pt = makePT('abc', '1x3')
    const res = getPieceIndex(pt, 1, 5, document)
    expect(res.pieceIndex).toBe(1)
    expect(res.charIndex).toBe(-1)
  })

  it('handles wrapping correctly', () => {
    document.columns = 2
    const pt = makePT('abc', '1x3')
    const res = getPieceIndex(pt, 2, 0, document)
    expect(res.pieceIndex).toBe(1)
    expect(res.charIndex).toBe(1)
  })

  it('handles wrapping with newlines correctly', () => {
    //   ab
    // \nc
    // \n1x3
    document.columns = 2
    const pt = makePT('ab\nc', '\n1x3')
    const res = getPieceIndex(pt, 2, 1, document)
    expect(res.pieceIndex).toBe(1)
    expect(res.charIndex).toBe(2)
  })

  it('handles wrapping with mutliple newlines correctly', () => {
    document.columns = 2
    const pt = makePT('ab\nc', '\n\n1x3')
    const res = getPieceIndex(pt, 3, 1, document)
    expect(res.pieceIndex).toBe(1)
    expect(res.charIndex).toBe(3)
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

  it('inserts text at the start of a row', () => {
    // hello
    // XXwor
    // ld
    const cursor = insertAtRowCol(pt, 1, 0, 'XX', document)
    expect(pt.add).toBe('XX')
    expect(cursor).toEqual({ curRow: 1, curCol: 2 })
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
    const cursor = insertAtRowCol(pt, 0, 5, 'XX', document)
    expect(pt.add).toBe('XX')
    expect(cursor).toEqual({ curRow: 1, curCol: 2 })
  })

  it('inserts text in virtual cell', () => {
    // hello  XX
    // world
    document.columns = 17
    const cursor = insertAtRowCol(pt, 0, 7, 'XX', document)
    expect(pt.add).toBe('  XX')
    expect(cursor).toEqual({ curRow: 0, curCol: 9 })
  })

  it('inserts text in virtual cell in last row', () => {
    // hello
    // world  XX
    document.columns = 17
    const cursor = insertAtRowCol(pt, 1, 7, 'XX', document)
    expect(pt.add).toBe('  XX')
    expect(cursor).toEqual({ curRow: 1, curCol: 9 })
  })
})
