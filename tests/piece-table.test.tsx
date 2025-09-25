import {
  getPieceTableCursorPosition,
  insertText,
  PieceTable,
} from '@/lib/piece-table'
import { DocumentState, useDocumentStore } from '@/lib/document-store'
import { describe, it, expect, beforeEach } from 'vitest'
import { buildRows } from '@/lib/render'
import { useMapStore } from '@/lib/cursor-store'

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
function setupMaps(pt: PieceTable, doc: DocumentState) {
  const data = buildRows(pt, doc)
  useMapStore.getState().setPieceMap(data.pieceMap)
  useMapStore.getState().setGridMap(data.gridMap)
  return data
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
    setupMaps(pt, document)
    const res = getPieceTableCursorPosition(0, 4)
    expect(res.pieceIndex).toBe(1)
    expect(res.charIndex).toBe(1)
  })

  it('handles newline correctly', () => {
    // abc  \n
    // 1x3
    const pt = makePT('abc', '\n1x3')
    setupMaps(pt, document)
    const res = getPieceTableCursorPosition(1, 1)
    expect(res.pieceIndex).toBe(1)
    expect(res.charIndex).toBe(2)
  })

  it('handles multiple newlines correctly', () => {
    // a   \n
    // bc  \n
    //     \n
    //     \n
    // 1x3
    const pt = makePT('a\nbc\n', '\n\n1x3')
    setupMaps(pt, document)
    const res = getPieceTableCursorPosition(4, 1)
    expect(res.pieceIndex).toBe(1)
    expect(res.charIndex).toBe(3)
  })

  it('handles word wrapping correctly 1', () => {
    document.columns = 3
    // abc\n
    // def
    // 123
    const pt = makePT('abc\ndef', '123')
    setupMaps(pt, document)
    const res = getPieceTableCursorPosition(0, 2)
    expect(res.pieceIndex).toBe(0)
    expect(res.charIndex).toBe(2)
    expect(res.isNewLine).toBe(false)
  })

  it('handles word wrapping correctly 2', () => {
    document.columns = 3
    // abc\n
    // def
    // 123
    const pt = makePT('abc\ndef', '123')
    setupMaps(pt, document)
    const res = getPieceTableCursorPosition(0, 3)
    expect(res.pieceIndex).toBe(0)
    expect(res.charIndex).toBe(2)
    expect(res.isNewLine).toBe(false)
  })

  it('handles word wrapping correctly 3', () => {
    document.columns = 3
    // abc\n
    // def
    // 123
    const pt = makePT('abc\ndef', '123')
    setupMaps(pt, document)
    const res = getPieceTableCursorPosition(1, 0)
    expect(res.pieceIndex).toBe(0)
    expect(res.charIndex).toBe(4)
    expect(res.isNewLine).toBe(false)
  })

  it('handles virtual cells correctly', () => {
    // abc__x\n
    // def123
    const pt = makePT('abc\ndef', '123')
    setupMaps(pt, document)
    const res = getPieceTableCursorPosition(0, 5)
    expect(res.pieceIndex).toBe(0)
    expect(res.charIndex).toBe(2)
    expect(res.isNewLine).toBe(false)
    expect(res.offset).toBe(3)
  })

  it('handles space correctly', () => {
    const pt = makePT('abc', ' 1x3')
    setupMaps(pt, document)
    const res = getPieceTableCursorPosition(0, 5)
    expect(res.pieceIndex).toBe(1)
    expect(res.charIndex).toBe(2)
  })

  it('handles multiple spaces correctly', () => {
    const pt = makePT('a bc', '   1 x3')
    setupMaps(pt, document)
    const res = getPieceTableCursorPosition(0, 9)
    expect(res.pieceIndex).toBe(1)
    expect(res.charIndex).toBe(5)
  })

  it('should show index at the end of array', () => {
    document.columns = 10
    const pt = makePT('abc', '1x3')
    setupMaps(pt, document)
    const res = getPieceTableCursorPosition(0, 10)
    expect(res.pieceIndex).toBe(1)
    expect(res.charIndex).toBe(2)
    expect(res.offset).toBe(5)
  })

  it('handles wrapping correctly', () => {
    document.columns = 2
    const pt = makePT('abc', '1x3')
    setupMaps(pt, document)
    const res = getPieceTableCursorPosition(2, 0)
    expect(res.pieceIndex).toBe(1)
    expect(res.charIndex).toBe(1)
  })

  it('handles wrapping with newlines correctly', () => {
    document.columns = 2
    //   ab
    // \nc
    // \n1x3
    const pt = makePT('ab\nc', '\n1x3')
    setupMaps(pt, document)
    const res = getPieceTableCursorPosition(2, 1)
    expect(res.pieceIndex).toBe(1)
    expect(res.charIndex).toBe(2)
  })

  it('handles wrapping with mutliple newlines correctly', () => {
    document.columns = 2
    const pt = makePT('ab\nc', '\n\n1x3')
    setupMaps(pt, document)
    const res = getPieceTableCursorPosition(3, 1)
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
    setupMaps(pt, document)

    const res = getPieceTableCursorPosition(1, 0)
    expect(res.pieceIndex).toBe(0)
    expect(res.charIndex).toBe(6)
    expect(res.isNewLine).toBe(false)
    expect(res.offset).toBe(0)

    const cursor = insertText(
      pt,
      res.pieceIndex,
      res.charIndex,
      res.offset,
      'XX',
    )
    expect(pt.add).toBe('XX')
    expect(pt.pieces.length).toBe(3)
    // function returns the index of the new piece, but in the case of an insert, we add one to the index
    // since we expect the cursor to end up in col 2, we expect the function to return col 1
    expect(cursor).toEqual({ pieceIndex: 1, charIndex: 1, offset: 1 })
  })

  it('inserts text in the middle of a piece', () => {
    // heXXl
    // lo
    // world
    setupMaps(pt, document)

    const res = getPieceTableCursorPosition(0, 2)
    expect(res.pieceIndex).toBe(0)
    expect(res.charIndex).toBe(2)
    expect(res.isNewLine).toBe(false)
    expect(res.offset).toBe(0)

    const cursor = insertText(
      pt,
      res.pieceIndex,
      res.charIndex,
      res.offset,
      'XX',
    )
    expect(pt.add).toBe('XX')
    expect(pt.pieces.length).toBe(3)
    expect(cursor).toEqual({ pieceIndex: 1, charIndex: 1, offset: 1 })
  })

  it('inserts text at the end of a row', () => {
    // hello
    // XX
    // world
    setupMaps(pt, document)

    const res = getPieceTableCursorPosition(0, 5)
    expect(res.pieceIndex).toBe(0)
    expect(res.charIndex).toBe(4)
    expect(res.isNewLine).toBe(false)
    expect(res.offset).toBe(1)

    const cursor = insertText(
      pt,
      res.pieceIndex,
      res.charIndex,
      res.offset,
      'XX',
    )
    expect(pt.add).toBe('XX')
    expect(pt.pieces.length).toBe(3)
    expect(cursor).toEqual({ pieceIndex: 1, charIndex: 1, offset: 1 })
  })

  it('inserts text at start of a row', () => {
    // hello
    // XXwor
    // ld
    setupMaps(pt, document)

    const res = getPieceTableCursorPosition(1, 0)
    expect(res.pieceIndex).toBe(0)
    expect(res.charIndex).toBe(6)
    expect(res.isNewLine).toBe(false)
    expect(res.offset).toBe(0)

    const cursor = insertText(
      pt,
      res.pieceIndex,
      res.charIndex,
      res.offset,
      'XX',
    )
    expect(pt.add).toBe('XX')
    expect(pt.pieces.length).toBe(3)
    expect(cursor).toEqual({ pieceIndex: 1, charIndex: 1, offset: 1 })
  })

  it('inserts text in virtual cell', () => {
    // hello  XX
    // world
    document.columns = 17
    setupMaps(pt, document)

    const res = getPieceTableCursorPosition(0, 7)
    expect(res.pieceIndex).toBe(0)
    expect(res.charIndex).toBe(4)
    expect(res.offset).toBe(3)

    const cursor = insertText(
      pt,
      res.pieceIndex,
      res.charIndex,
      res.offset,
      'XX',
    )
    expect(pt.add).toBe('  XX')
    expect(pt.pieces.length).toBe(3)
    expect(cursor).toEqual({ pieceIndex: 1, charIndex: 3, offset: 1 })
  })

  it('inserts text in virtual cell in last row', () => {
    // hello
    // world  XX
    document.columns = 17
    setupMaps(pt, document)

    const res = getPieceTableCursorPosition(1, 7)
    expect(res.pieceIndex).toBe(0)
    expect(res.charIndex).toBe(10)
    expect(res.offset).toBe(3)

    const cursor = insertText(
      pt,
      res.pieceIndex,
      res.charIndex,
      res.offset,
      'XX',
    )
    expect(pt.add).toBe('  XX')
    expect(pt.pieces.length).toBe(2)
    expect(cursor).toEqual({ pieceIndex: 1, charIndex: 3, offset: 1 })
  })
})
