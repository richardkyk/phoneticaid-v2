import type { DocumentState } from './stores/document-store'

// Maps the logical grid (lines of slots, see layout.ts) onto the physical page
// for each writing mode. Everything is in mm, relative to the page's top left.
//
// Internally positions are expressed along the line (`a`, the direction text
// flows) and across lines (`c`, the direction lines stack), measured from the
// start of the content area, then converted to x/y for the writing mode.

export type WritingMode =
  'horizontal-ltr' | 'horizontal-rtl' | 'vertical-rl' | 'vertical-lr'

export const writingModes: Array<{
  value: WritingMode
  label: string
  // for where there's less room
  shortLabel?: string
}> = [
  { value: 'horizontal-ltr', label: 'Left to right' },
  { value: 'horizontal-rtl', label: 'Right to left' },
  {
    value: 'vertical-rl',
    label: 'Vertical, right to left',
    shortLabel: 'Vertical (R→L)',
  },
  {
    value: 'vertical-lr',
    label: 'Vertical, left to right',
    shortLabel: 'Vertical (L→R)',
  },
]

export type GeometrySettings = Pick<
  DocumentState,
  | 'writingMode'
  | 'layout'
  | 'fontSize'
  | 'pinyinSize'
  | 'pinyinOffset'
  | 'pinyinPosition'
  | 'pinyinSide'
  | 'gapX'
  | 'gapY'
  | 'marginX'
  | 'marginY'
>

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

// thinnest the caret is drawn, in mm (~2px)
const MIN_CARET_THICKNESS = 0.5

export const isVertical = (mode: WritingMode) => mode.startsWith('vertical')

export const pageSize = (doc: Pick<GeometrySettings, 'layout'>) =>
  doc.layout === 'portrait'
    ? { width: 210, height: 297 }
    : { width: 297, height: 210 }

// distance from the start of one character to the next along a line
export const charAdvance = (doc: GeometrySettings) =>
  doc.fontSize + (isVertical(doc.writingMode) ? doc.gapY : doc.gapX)

// room taken across the line by the pinyin, kept when it's turned off (e.g.
// for writing it in by hand)
const pinyinBand = (doc: GeometrySettings) => doc.pinyinSize + doc.pinyinOffset

// distance from the start of one line to the next
export const linePitch = (doc: GeometrySettings) =>
  doc.fontSize +
  pinyinBand(doc) +
  (isVertical(doc.writingMode) ? doc.gapX : doc.gapY)

export const linesPerPage = (doc: GeometrySettings) => {
  const page = pageSize(doc)
  const extent = isVertical(doc.writingMode)
    ? page.width - doc.marginX * 2
    : page.height - doc.marginY * 2
  return Math.max(1, Math.floor(extent / linePitch(doc)))
}

// whether the pinyin comes before the character across the line, i.e. it is
// above (horizontal), right of (vertical-rl) or left of (vertical-lr) it
const pinyinFirst = (doc: GeometrySettings) => {
  switch (doc.writingMode) {
    case 'horizontal-ltr':
    case 'horizontal-rtl':
      return doc.pinyinPosition === 'top'
    case 'vertical-rl':
      return doc.pinyinSide === 'right'
    case 'vertical-lr':
      return doc.pinyinSide === 'left'
  }
}

// converts a box at along `a` / across `c` with along size `l` and across
// size `s` to a physical rect
function toPhysical(
  doc: GeometrySettings,
  a: number,
  c: number,
  l: number,
  s: number,
): Rect {
  const page = pageSize(doc)
  switch (doc.writingMode) {
    case 'horizontal-ltr':
      return { x: doc.marginX + a, y: doc.marginY + c, width: l, height: s }
    case 'horizontal-rtl':
      return {
        x: page.width - doc.marginX - a - l,
        y: doc.marginY + c,
        width: l,
        height: s,
      }
    case 'vertical-rl':
      return {
        x: page.width - doc.marginX - c - s,
        y: doc.marginY + a,
        width: s,
        height: l,
      }
    case 'vertical-lr':
      return { x: doc.marginX + c, y: doc.marginY + a, width: s, height: l }
  }
}

// inverse of toPhysical for a point
function toLogical(doc: GeometrySettings, x: number, y: number) {
  const page = pageSize(doc)
  switch (doc.writingMode) {
    case 'horizontal-ltr':
      return { a: x - doc.marginX, c: y - doc.marginY }
    case 'horizontal-rtl':
      return { a: page.width - doc.marginX - x, c: y - doc.marginY }
    case 'vertical-rl':
      return { a: y - doc.marginY, c: page.width - doc.marginX - x }
    case 'vertical-lr':
      return { a: y - doc.marginY, c: x - doc.marginX }
  }
}

const charAcross = (doc: GeometrySettings, line: number) =>
  line * linePitch(doc) + (pinyinFirst(doc) ? pinyinBand(doc) : 0)

// the square a character is drawn in
export const charRect = (doc: GeometrySettings, line: number, slot: number) =>
  toPhysical(
    doc,
    slot * charAdvance(doc),
    charAcross(doc, line),
    doc.fontSize,
    doc.fontSize,
  )

// the strip beside the character that its pinyin is drawn in
export const pinyinRect = (doc: GeometrySettings, line: number, slot: number) =>
  toPhysical(
    doc,
    slot * charAdvance(doc),
    line * linePitch(doc) +
      (pinyinFirst(doc) ? 0 : doc.fontSize + doc.pinyinOffset),
    doc.fontSize,
    doc.pinyinSize,
  )

// the caret before `slot`, drawn in the gap before the character
export const caretRect = (
  doc: GeometrySettings,
  line: number,
  slot: number,
) => {
  const gap = charAdvance(doc) - doc.fontSize
  const thickness = Math.max(gap, MIN_CARET_THICKNESS)
  return toPhysical(
    doc,
    slot * charAdvance(doc) - thickness,
    charAcross(doc, line),
    thickness,
    doc.fontSize,
  )
}

// highlight covering slots startSlot..endSlot (inclusive), stopping at the
// last character's edge so it leaves the caret's gap after it clear
export const spanRect = (
  doc: GeometrySettings,
  line: number,
  startSlot: number,
  endSlot: number,
) =>
  toPhysical(
    doc,
    startSlot * charAdvance(doc),
    charAcross(doc, line),
    (endSlot - startSlot) * charAdvance(doc) + doc.fontSize,
    doc.fontSize,
  )

// The caret position under a point on the page. `line` is relative to the
// page and not clamped, `slot` is clamped to 0..columns and rounds to the
// nearest side of the character under the point.
export function hitTest(
  doc: GeometrySettings,
  columns: number,
  x: number,
  y: number,
) {
  const { a, c } = toLogical(doc, x, y)
  const line = Math.floor(c / linePitch(doc))
  const slot = Math.min(
    Math.max(Math.floor(a / charAdvance(doc)), 0),
    columns - 1,
  )
  const pastMiddle = a > slot * charAdvance(doc) + doc.fontSize / 2
  return { line, slot: pastMiddle ? slot + 1 : slot }
}

export type CaretMove =
  'prevChar' | 'nextChar' | 'prevLine' | 'nextLine' | 'lineStart' | 'lineEnd'

// what an arrow key means in each writing mode
const arrowMoves: Record<WritingMode, Record<string, CaretMove>> = {
  'horizontal-ltr': {
    ArrowLeft: 'prevChar',
    ArrowRight: 'nextChar',
    ArrowUp: 'prevLine',
    ArrowDown: 'nextLine',
  },
  'horizontal-rtl': {
    ArrowLeft: 'nextChar',
    ArrowRight: 'prevChar',
    ArrowUp: 'prevLine',
    ArrowDown: 'nextLine',
  },
  'vertical-rl': {
    ArrowUp: 'prevChar',
    ArrowDown: 'nextChar',
    ArrowRight: 'prevLine',
    ArrowLeft: 'nextLine',
  },
  'vertical-lr': {
    ArrowUp: 'prevChar',
    ArrowDown: 'nextChar',
    ArrowLeft: 'prevLine',
    ArrowRight: 'nextLine',
  },
}

export function keyToCaretMove(
  mode: WritingMode,
  key: string,
): CaretMove | null {
  if (key === 'Home') return 'lineStart'
  if (key === 'End') return 'lineEnd'
  return arrowMoves[mode][key] ?? null
}

// background behind the characters in slots startSlot..endSlot (inclusive)
// and their pinyin, leaving the gaps either side so neighbouring words stay
// apart
export const wordRect = (
  doc: GeometrySettings,
  line: number,
  startSlot: number,
  endSlot: number,
) =>
  toPhysical(
    doc,
    startSlot * charAdvance(doc),
    line * linePitch(doc),
    (endSlot - startSlot) * charAdvance(doc) + doc.fontSize,
    doc.fontSize + pinyinBand(doc),
  )
