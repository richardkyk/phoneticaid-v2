import { useCursorStore } from '@/lib/stores/cursor-store'
import { DocumentState, useDocumentStore } from '@/lib/stores/document-store'
import { Fragment } from 'react/jsx-runtime'
import { getGridCursorPosition } from '@/lib/piece-table'
import { Cell } from '@/lib/render'
import { cn } from '@/lib/utils'
import { pinyin } from 'pinyin'

interface GridProps {
  pageIndex: number
  pageRows: Cell[][]
  rowsPerPage: number
}
export const Grid = (props: GridProps) => {
  const document = useDocumentStore()
  const offset =
    props.pageIndex *
    (props.rowsPerPage *
      (document.gapY +
        document.fontSize +
        document.pinyinSize +
        document.pinyinOffset))

  return (
    <Fragment>
      {props.pageRows.map((row, i) => {
        const content = row.map((cell) => cell.content).join('')

        const py = pinyin(content.replace(/[^\u4e00-\u9fff]/g, ' '), {
          segment: true,
        })
        const result = py.flatMap(([s]) => {
          // check for Latin or accented letters (for pinyin)
          const hasPinyin = /[a-zA-Z\u00C0-\u017F]/.test(s)
          if (hasPinyin) return [s]
          // otherwise split each character into an empty string placeholder
          return Array.from(s).map(() => '')
        })
        return row.map((cell, j) => (
          <div
            key={`${i}-${j}`}
            className="absolute"
            style={{
              top: `${cell.y - offset}mm`,
              left: `${cell.x}mm`,
            }}
          >
            <div
              className="absolute justify-center flex items-center font-sans inset-x-0"
              style={{
                fontSize: `${document.pinyinSize}mm`,
                bottom:
                  document.pinyinPosition === 'top'
                    ? `${document.pinyinOffset + cell.height}mm`
                    : undefined,
                top:
                  document.pinyinPosition === 'bottom'
                    ? `${document.pinyinOffset + cell.height}mm`
                    : undefined,
                height: `${document.pinyinSize}mm`,
              }}
            >
              {result[j]}
            </div>
            <div
              data-debug={document.debug ? '' : undefined}
              data-last={cell.col === document.columns ? '' : undefined}
              data-odd={
                document.debug && cell.pieceIndex % 2 === 0 ? '' : undefined
              }
              data-even={
                document.debug && cell.pieceIndex % 2 === 1 ? '' : undefined
              }
              className={cn(
                'data-[highlight]:bg-yellow-100 overflow-hidden data-[last]:opacity-0 data-[odd]:bg-blue-100 data-[even]:bg-red-100 [[data-debug][data-last]]:opacity-100 flex items-center justify-center shadow-[0_0_0_1px_rgba(0,0,0,0.05)] text-gray-600 cursor-text',
                'data-[last]:bg-[repeating-linear-gradient(135deg,theme(colors.gray.200),theme(colors.gray.200)_5px,transparent_5px,transparent_10px)]',
              )}
              style={{
                width: `${cell.width}mm`,
                height: `${cell.height}mm`,
              }}
            >
              <span style={{ fontSize: `${cell.height}mm` }}>
                {cell.content}
              </span>
              {document.debug && (
                <Fragment>
                  <div className="absolute text-[10px] left-0 top-0 select-none">
                    ({i},{j})
                  </div>
                  <div className="absolute text-[10px] left-0 bottom-0 select-none">
                    {cell.pieceIndex === -1 && `+${cell.offset}`}
                    {cell.pieceIndex !== -1 &&
                      `[${cell.pieceIndex}][${cell.charIndex}]`}
                  </div>
                </Fragment>
              )}
            </div>
          </div>
        ))
      })}
    </Fragment>
  )
}

interface CursorProps {
  document: DocumentState
  pieceMap: Map<string, string>
  pageIndex: number
  rowsPerPage: number
}
export const Cursor = (props: CursorProps) => {
  const { document, pieceMap } = props

  const visible = useCursorStore((state) => state.visible)
  let pieceIndex = useCursorStore((state) => state.pieceIndex)
  let charIndex = useCursorStore((state) => state.charIndex)
  let offset = useCursorStore((state) => state.offset)

  let { row, col, isNewLine } = getGridCursorPosition(
    pieceIndex,
    charIndex,
    pieceMap,
  )
  if (isNewLine) {
    row++
    col = offset - 1
  } else {
    col += offset
  }

  const minRow = props.pageIndex * props.rowsPerPage
  const maxRow = minRow + props.rowsPerPage

  if (row >= maxRow || row < minRow) return null

  const pinyinHeight = document.pinyinSize + document.pinyinOffset
  const cursorX = document.marginX + col * (document.gapX + document.fontSize)
  const cursorY =
    (row - props.pageIndex * props.rowsPerPage) *
      (document.fontSize + document.gapY + pinyinHeight) +
    document.marginY +
    (document.pinyinPosition === 'top' ? pinyinHeight : 0)

  return (
    <Fragment>
      {document.debug && (
        <div className="absolute top-0 left-0">
          {`(${row},${col}) -> [${pieceIndex}][${charIndex}]+${offset}_${isNewLine}`}
        </div>
      )}
      {visible && (
        <div
          id="cursor"
          key={`${cursorX}-${cursorY}-${document.gapX}`}
          className="absolute bg-black opacity-100 animate-caret-blink scroll-mb-[100px] scroll-mt-[100px]"
          style={{
            top: `${cursorY}mm`,
            left: `${cursorX}mm`,
            width: `max(${document.gapX}mm, 2px)`,
            height: `${document.fontSize}mm`,
            transform: `translateX(-100%)`,
          }}
        ></div>
      )}
    </Fragment>
  )
}

type Point = { row: number; col: number }
type HighlightSpan = { row: number; startCol: number; endCol: number } // inclusive endCol

function getHighlightSpans(
  start: Point | null,
  end: Point | null,
  maxCols: number,
): HighlightSpan[] {
  if (!start || !end) return []

  // normalize to document order (s <= e)
  const [s, e] =
    start.row < end.row || (start.row === end.row && start.col <= end.col)
      ? [start, end]
      : [end, start]

  // If identical caret positions -> empty selection
  if (s.row === e.row && s.col === e.col) return []

  const spans: HighlightSpan[] = []

  for (let r = s.row; r <= e.row; r++) {
    const startCol = r === s.row ? s.col : 0
    // treat end caret as exclusive, so inclusive endCol is (e.col - 1) on the last row
    const endCol = r === e.row ? e.col - 1 : maxCols - 1

    // skip if the computed end is before start (can happen when e.col === 0)
    if (endCol < startCol) continue

    spans.push({ row: r, startCol, endCol })
  }

  return spans
}

interface HighlightProps {
  pageIndex: number
  rowsPerPage: number
}
export const Highlight = (props: HighlightProps) => {
  const document = useDocumentStore()
  const selectionStart = useCursorStore((s) => s.selectionStart)
  const selectionEnd = useCursorStore((s) => s.selectionEnd)

  const minRow = props.pageIndex * props.rowsPerPage
  const maxRow = minRow + props.rowsPerPage

  if (!selectionStart || !selectionEnd) return null

  const spans = getHighlightSpans(
    selectionStart,
    selectionEnd,
    document.columns,
  ).filter((x) => x.row >= minRow && x.row < maxRow)

  const pinyinHeight = document.pinyinSize + document.pinyinOffset
  const charHeight = document.fontSize + document.gapY
  const rowHeight = (charHeight + pinyinHeight) * document.mmY
  const colWidth = (document.fontSize + document.gapX) * document.mmX
  const marginX = document.marginX * document.mmX
  const marginY = document.marginY * document.mmY

  return (
    <>
      {spans.map((span) => (
        <div
          key={`${span.row}-${span.startCol}-${span.endCol}`}
          className="absolute bg-yellow-200 opacity-40 pointer-events-none"
          style={{
            top:
              marginY +
              (span.row % props.rowsPerPage) * rowHeight +
              (document.pinyinPosition === 'top'
                ? pinyinHeight * document.mmY
                : 0),
            left: marginX + span.startCol * colWidth,
            width: (span.endCol - span.startCol + 1) * colWidth,
            height: document.fontSize * document.mmY,
          }}
        />
      ))}
    </>
  )
}
