import {
  resolveCharPosition,
  insertAtRowCol,
  PieceTable,
} from '@/lib/piece-table'
import { useDocumentStore } from '@/lib/document-store'
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
    makePT('abc', '1x3')
    const res = resolveCharPosition(0, 4)
    expect(res.pieceIndex).toBe(1)
    expect(res.charIndex).toBe(1)
  })

  it('handles newline correctly', () => {
    // abc  \n
    // 1x3
    makePT('abc', '\n1x3')
    const res = resolveCharPosition(1, 1)
    expect(res.pieceIndex).toBe(1)
    expect(res.charIndex).toBe(2)
  })

  it('handles multiple newlines correctly', () => {
    // a   \n
    // bc  \n
    //     \n
    //     \n
    // 1x3
    makePT('a\nbc\n', '\n\n1x3')
    const res = resolveCharPosition(4, 1)
    expect(res.pieceIndex).toBe(1)
    expect(res.charIndex).toBe(3)
  })

  it('handles word wrapping correctly 1', () => {
    document.columns = 3
    // abc\n
    // def
    // 123
    makePT('abc\ndef', '123')
    const res = resolveCharPosition(0, 2)
    expect(res.pieceIndex).toBe(0)
    expect(res.charIndex).toBe(2)
    expect(res.isNewline).toBe(false)
  })

  it('handles word wrapping correctly 2', () => {
    document.columns = 3
    // abc\n
    // def
    // 123
    makePT('abc\ndef', '123')
    const res = resolveCharPosition(0, 3)
    expect(res.pieceIndex).toBe(0)
    expect(res.charIndex).toBe(3)
    expect(res.isNewline).toBe(true)
  })

  it('handles word wrapping correctly 3', () => {
    document.columns = 3
    // abc\n
    // def
    // 123
    makePT('abc\ndef', '123')
    const res = resolveCharPosition(1, 0)
    expect(res.pieceIndex).toBe(0)
    expect(res.charIndex).toBe(4)
    expect(res.isNewline).toBe(false)
  })

  it('handles virtual cells correctly', () => {
    // abc__x\n
    // def123
    makePT('abc\ndef', '123')
    const res = resolveCharPosition(0, 5)
    expect(res.pieceIndex).toBe(0)
    expect(res.charIndex).toBe(3)
    expect(res.isNewline).toBe(true)
    expect(res.padding).toBe(2)
  })

  it('handles space correctly', () => {
    makePT('abc', ' 1x3')
    const res = resolveCharPosition(0, 5)
    expect(res.pieceIndex).toBe(1)
    expect(res.charIndex).toBe(2)
  })

  it('handles multiple spaces correctly', () => {
    makePT('a bc', '   1 x3')
    const res = resolveCharPosition(0, 9)
    expect(res.pieceIndex).toBe(1)
    expect(res.charIndex).toBe(5)
  })

  it('should show index at the end of array', () => {
    makePT('abc', '1x3')
    const res = resolveCharPosition(1, 5)
    expect(res.pieceIndex).toBe(1)
    expect(res.charIndex).toBe(-1)
  })

  it('handles wrapping correctly', () => {
    document.columns = 2
    makePT('abc', '1x3')
    const res = resolveCharPosition(2, 0)
    expect(res.pieceIndex).toBe(1)
    expect(res.charIndex).toBe(1)
  })

  it('handles wrapping with newlines correctly', () => {
    //   ab
    // \nc
    // \n1x3
    document.columns = 2
    makePT('ab\nc', '\n1x3')
    const res = resolveCharPosition(2, 1)
    expect(res.pieceIndex).toBe(1)
    expect(res.charIndex).toBe(2)
  })

  it('handles wrapping with mutliple newlines correctly', () => {
    document.columns = 2
    makePT('ab\nc', '\n\n1x3')
    const res = resolveCharPosition(3, 1)
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
    const cursor = insertAtRowCol(pt, 1, 0, 'XX')
    expect(pt.add).toBe('XX')
    expect(pt.pieces.length).toBe(3)
    // function returns the index of the new piece, but in the case of an insert, we add one to the index
    // since we expect the cursor to end up in col 2, we expect the function to return col 1
    expect(cursor).toEqual({ curRow: 1, curCol: 1 })
  })

  it('inserts text in the middle of a piece', () => {
    // heXXl
    // lo
    // world
    const cursor = insertAtRowCol(pt, 0, 2, 'XX')
    expect(pt.add).toBe('XX')
    expect(pt.pieces.length).toBe(3)
    expect(cursor).toEqual({ curRow: 0, curCol: 3 })
  })

  it('inserts text at the end of a row', () => {
    // hello
    // XX
    // world
    const cursor = insertAtRowCol(pt, 0, 5, 'XX')
    expect(pt.add).toBe('XX')
    expect(pt.pieces.length).toBe(3)
    expect(cursor).toEqual({ curRow: 1, curCol: 1 })
  })

  it('inserts text in virtual cell', () => {
    // hello  XX
    // world
    document.columns = 17
    const cursor = insertAtRowCol(pt, 0, 7, 'XX')
    expect(pt.add).toBe('  XX')
    expect(pt.pieces.length).toBe(3)
    expect(cursor).toEqual({ curRow: 0, curCol: 8 })
  })

  it('inserts text in virtual cell in last row', () => {
    // hello
    // world  XX
    document.columns = 17
    const cursor = insertAtRowCol(pt, 1, 7, 'XX')
    expect(pt.add).toBe('  XX')
    expect(pt.pieces.length).toBe(2)
    expect(cursor).toEqual({ curRow: 1, curCol: 8 })
  })
})
