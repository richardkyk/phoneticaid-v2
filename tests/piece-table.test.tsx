import { getPieceIndex, PieceTable } from '@/lib/piece-table'
import { useDocumentStore } from '@/lib/store'
import { describe, it, expect } from 'vitest'

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
document.columns = 17

describe('getPieceIndex', () => {
  it('returns the correct values', () => {
    const pt = makePT('abc', '1x3')
    const res = getPieceIndex(pt, 0, 4, document)
    expect(res.pieceIndex).toBe(1)
    expect(res.offsetInPiece).toBe(1)
    expect(res.padding).toBe(false)
  })

  it('handles newline correctly', () => {
    const pt = makePT('abc', '\n1x3')
    const res = getPieceIndex(pt, 1, 1, document)
    expect(res.pieceIndex).toBe(1)
    expect(res.offsetInPiece).toBe(2)
    expect(res.padding).toBe(false)
  })

  it('handles multiple newlines correctly', () => {
    const pt = makePT('a\nbc\n', '\n\n1x3')
    const res = getPieceIndex(pt, 4, 1, document)
    expect(res.pieceIndex).toBe(1)
    expect(res.offsetInPiece).toBe(3)
    expect(res.padding).toBe(false)
  })

  it('handles space correctly', () => {
    const pt = makePT('abc', ' 1x3')
    const res = getPieceIndex(pt, 0, 5, document)
    expect(res.pieceIndex).toBe(1)
    expect(res.offsetInPiece).toBe(2)
    expect(res.padding).toBe(false)
  })

  it('handles multiple spaces correctly', () => {
    const pt = makePT('a bc', '   1 x3')
    const res = getPieceIndex(pt, 0, 9, document)
    expect(res.pieceIndex).toBe(1)
    expect(res.offsetInPiece).toBe(5)
    expect(res.padding).toBe(false)
  })

  it('handles padding correctly', () => {
    const pt = makePT('abc', '1x3')
    const res = getPieceIndex(pt, 1, 5, document)
    expect(res.pieceIndex).toBe(1)
    expect(res.offsetInPiece).toBe(3)
    expect(res.padding).toBe(true)
  })

  it('handles wrapping correctly', () => {
    document.columns = 2
    const pt = makePT('abc', '1x3')
    const res = getPieceIndex(pt, 2, 0, document)
    expect(res.pieceIndex).toBe(1)
    expect(res.offsetInPiece).toBe(1)
    expect(res.padding).toBe(false)
  })

  it('handles wrapping with newlines correctly', () => {
    document.columns = 2
    const pt = makePT('ab\nc', '\n1x3')
    const res = getPieceIndex(pt, 2, 1, document)
    expect(res.pieceIndex).toBe(1)
    expect(res.offsetInPiece).toBe(2)
    expect(res.padding).toBe(false)
  })

  it('handles wrapping with mutliple newlines correctly', () => {
    document.columns = 2
    const pt = makePT('ab\nc', '\n\n1x3')
    const res = getPieceIndex(pt, 3, 1, document)
    expect(res.pieceIndex).toBe(1)
    expect(res.offsetInPiece).toBe(3)
    expect(res.padding).toBe(false)
  })
})
