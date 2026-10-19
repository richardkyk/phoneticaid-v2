import { describe, expect, it } from 'vitest'
import {
  caretRect,
  charRect,
  hitTest,
  keyToCaretMove,
  linesPerPage,
  pinyinRect,
  writingModes,
} from '@/lib/geometry'
import type { GeometrySettings, Rect, WritingMode } from '@/lib/geometry'
import { defaultDocumentState } from '@/lib/stores/document-store'

const doc = (overrides: Partial<GeometrySettings> = {}): GeometrySettings => ({
  ...defaultDocumentState(),
  ...overrides,
})

const center = (r: Rect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 })
// edges that touch don't count, with some tolerance for floating point error
const EPSILON = 1e-9
const overlaps = (a: Rect, b: Rect) =>
  a.x + EPSILON < b.x + b.width &&
  b.x + EPSILON < a.x + a.width &&
  a.y + EPSILON < b.y + b.height &&
  b.y + EPSILON < a.y + a.height

const modes = writingModes.map((m) => m.value)
const COLUMNS = 10

describe.each(modes)('%s', (writingMode) => {
  const d = doc({ writingMode })

  it('hit tests a point just before/after the middle of a character to either side of it', () => {
    for (let line = 0; line < 3; line++) {
      for (let slot = 0; slot < COLUMNS; slot++) {
        const r = charRect(d, line, slot)
        const c = center(r)
        // a point a little towards the start / end of the line from the centre
        const nudge = 0.1
        const [before, after] = (() => {
          switch (writingMode) {
            case 'horizontal-ltr':
              return [
                { ...c, x: c.x - nudge },
                { ...c, x: c.x + nudge },
              ]
            case 'horizontal-rtl':
              return [
                { ...c, x: c.x + nudge },
                { ...c, x: c.x - nudge },
              ]
            default:
              return [
                { ...c, y: c.y - nudge },
                { ...c, y: c.y + nudge },
              ]
          }
        })()
        expect(hitTest(d, COLUMNS, before.x, before.y)).toEqual({ line, slot })
        expect(hitTest(d, COLUMNS, after.x, after.y)).toEqual({
          line,
          slot: slot + 1,
        })
      }
    }
  })

  it('draws characters on the page without overlapping each other', () => {
    const rects: Rect[] = []
    for (let line = 0; line < linesPerPage(d); line++) {
      for (let slot = 0; slot < 5; slot++) rects.push(charRect(d, line, slot))
    }
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(0)
      expect(r.y).toBeGreaterThanOrEqual(0)
    }
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        expect(overlaps(rects[i], rects[j])).toBe(false)
      }
    }
  })

  it('keeps the pinyin beside its character, not on top of it', () => {
    expect(overlaps(charRect(d, 1, 2), pinyinRect(d, 1, 2))).toBe(false)
  })

  it('draws the caret in the gap before the character', () => {
    const caret = caretRect(d, 0, 3)
    expect(overlaps(caret, charRect(d, 0, 3))).toBe(false)
    expect(overlaps(caret, charRect(d, 0, 2))).toBe(false)
  })
})

describe('direction of flow', () => {
  const first = (writingMode: WritingMode) =>
    charRect(doc({ writingMode }), 0, 0)
  const next = (writingMode: WritingMode) =>
    charRect(doc({ writingMode }), 0, 1)
  const nextLine = (writingMode: WritingMode) =>
    charRect(doc({ writingMode }), 1, 0)

  it('horizontal-ltr: characters go right, lines go down', () => {
    expect(next('horizontal-ltr').x).toBeGreaterThan(first('horizontal-ltr').x)
    expect(nextLine('horizontal-ltr').y).toBeGreaterThan(
      first('horizontal-ltr').y,
    )
  })

  it('horizontal-rtl: characters go left from the right margin, lines go down', () => {
    const d = doc({ writingMode: 'horizontal-rtl' })
    const r = first('horizontal-rtl')
    expect(r.x + r.width).toBeCloseTo(297 - d.marginX)
    expect(next('horizontal-rtl').x).toBeLessThan(r.x)
    expect(nextLine('horizontal-rtl').y).toBeGreaterThan(r.y)
  })

  it('vertical-rl: characters go down, lines go left from the right margin', () => {
    const d = doc({ writingMode: 'vertical-rl' })
    const r = first('vertical-rl')
    expect(r.y).toBeCloseTo(d.marginY)
    expect(next('vertical-rl').y).toBeGreaterThan(r.y)
    expect(nextLine('vertical-rl').x).toBeLessThan(r.x)
  })

  it('vertical-lr: characters go down, lines go right', () => {
    const r = first('vertical-lr')
    expect(next('vertical-lr').y).toBeGreaterThan(r.y)
    expect(nextLine('vertical-lr').x).toBeGreaterThan(r.x)
  })
})

describe('pinyin placement', () => {
  it('goes above or below in horizontal modes', () => {
    const below = doc({ pinyinPosition: 'bottom' })
    const above = doc({ pinyinPosition: 'top' })
    expect(pinyinRect(below, 0, 0).y).toBeGreaterThan(charRect(below, 0, 0).y)
    expect(pinyinRect(above, 0, 0).y).toBeLessThan(charRect(above, 0, 0).y)
  })

  it.each(['vertical-rl', 'vertical-lr'] as const)(
    'goes left or right in %s',
    (writingMode) => {
      const right = doc({ writingMode, pinyinSide: 'right' })
      const left = doc({ writingMode, pinyinSide: 'left' })
      expect(pinyinRect(right, 0, 0).x).toBeGreaterThan(charRect(right, 0, 0).x)
      expect(pinyinRect(left, 0, 0).x).toBeLessThan(charRect(left, 0, 0).x)
    },
  )
})

describe('linesPerPage', () => {
  it('counts rows down the page, or columns across it when vertical', () => {
    const horizontal = doc({ layout: 'portrait' })
    const vertical = doc({ layout: 'portrait', writingMode: 'vertical-rl' })
    // portrait pages are taller than they are wide
    expect(linesPerPage(horizontal)).toBeGreaterThan(linesPerPage(vertical))
  })
})

describe('keyToCaretMove', () => {
  it('maps arrows to the direction text flows', () => {
    expect(keyToCaretMove('horizontal-ltr', 'ArrowRight')).toBe('nextChar')
    expect(keyToCaretMove('horizontal-rtl', 'ArrowLeft')).toBe('nextChar')
    expect(keyToCaretMove('vertical-rl', 'ArrowDown')).toBe('nextChar')
    expect(keyToCaretMove('vertical-rl', 'ArrowLeft')).toBe('nextLine')
    expect(keyToCaretMove('vertical-lr', 'ArrowRight')).toBe('nextLine')
    expect(keyToCaretMove('vertical-lr', 'Home')).toBe('lineStart')
    expect(keyToCaretMove('horizontal-ltr', 'a')).toBeNull()
  })
})
