import { useCursorStore } from '@/lib/stores/cursor-store'
import { DocumentStore } from '@/lib/stores/document-store'
import { Fragment } from 'react/jsx-runtime'
import { Cell, GridPoint, Layout, positionToGrid } from '@/lib/layout'
import {
  caretRect,
  charRect,
  isVertical,
  pinyinRect,
  spanRect,
} from '@/lib/geometry'
import type { Rect } from '@/lib/geometry'
import { cn } from '@/lib/utils'
import { pinyin } from 'pinyin'

// absolute positioning for a rect in mm
const rectStyle = (rect: Rect, document: DocumentStore) => ({
  left: `${rect.x * document.mmX}px`,
  top: `${rect.y * document.mmY}px`,
  width: `${rect.width * document.mmX}px`,
  height: `${rect.height * document.mmY}px`,
})

// pinyin for each character of a line, '' for characters without any
function linePinyin(row: Cell[]) {
  const content = row.map((cell) => cell.content).join('')

  const py = pinyin(
    content.replace(/\u{E0000}/gu, '母').replace(/[^一-鿿]/g, ' '),
    {
      segment: true,
    },
  )
  return py.flatMap(([s]) => {
    // check for Latin or accented letters (for pinyin)
    const hasPinyin = /[a-zA-ZÀ-ſ]/.test(s)
    if (hasPinyin) return [s]
    // otherwise split each character into an empty string placeholder
    return Array.from(s).map(() => '')
  })
}

interface GridProps {
  pageIndex: number
  pageRows: Cell[][]
  document: DocumentStore
}
export const Grid = (props: GridProps) => {
  const document = props.document
  const vertical = isVertical(document.writingMode)

  return (
    <Fragment>
      {props.pageRows.map((row, i) => {
        const result = linePinyin(row)

        return row.map((cell, j) => {
          const char = charRect(document, i, cell.col)
          const py = pinyinRect(document, i, cell.col)

          return (
            <Fragment key={`${i}-${j}`}>
              <div
                className="absolute justify-center flex items-center font-sans whitespace-nowrap"
                style={{
                  ...rectStyle(py, document),
                  fontSize: `${document.pinyinSize * document.mmY}px`,
                  // pinyin runs down the side of the character in vertical modes
                  writingMode: vertical ? 'vertical-rl' : undefined,
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
                  'absolute data-[highlight]:bg-yellow-100 overflow-hidden print:[[data-debug][data-last]]:hidden data-[last]:opacity-0 data-[odd]:bg-blue-100 data-[even]:bg-red-100 [[data-debug][data-last]]:opacity-100 flex items-center justify-center print:shadow-none shadow-[0_0_0_1px_rgba(0,0,0,0.05)] text-gray-600 cursor-text',
                  'data-[last]:bg-[repeating-linear-gradient(135deg,theme(colors.gray.200),theme(colors.gray.200)_5px,transparent_5px,transparent_10px)]',
                )}
                style={rectStyle(char, document)}
              >
                <span
                  className="font-chinese"
                  style={{
                    fontSize: `${document.fontSize * document.mmY}px`,
                    // use the font's vertical forms (e.g. punctuation sits top
                    // right), keeping every character upright
                    writingMode: vertical ? 'vertical-rl' : undefined,
                    textOrientation: vertical ? 'upright' : undefined,
                  }}
                >
                  {cell.content}
                </span>
                {document.debug && (
                  <Fragment>
                    <div className="absolute print:hidden text-[10px] left-0 top-0 select-none">
                      ({i},{j})
                    </div>
                    <div className="absolute print:hidden text-[10px] left-0 bottom-0 select-none">
                      {cell.index === -1 && `+${cell.virtual}`}
                      {cell.index !== -1 &&
                        `${cell.index} [${cell.pieceIndex}]`}
                    </div>
                  </Fragment>
                )}
              </div>
            </Fragment>
          )
        })
      })}
    </Fragment>
  )
}

interface CursorProps {
  document: DocumentStore
  layout: Layout
  pageIndex: number
}
export const Cursor = (props: CursorProps) => {
  const { document, layout } = props

  const focused = useCursorStore((state) => state.focused)
  const index = useCursorStore((state) => state.index)
  const virtual = useCursorStore((state) => state.virtual)
  const affinity = useCursorStore((state) => state.affinity)

  const { row, col } = positionToGrid(layout, { index, virtual, affinity })

  const linesPerPage = document.linesPerPage()
  const line = row - props.pageIndex * linesPerPage
  if (line < 0 || line >= linesPerPage) return null

  const rect = caretRect(document, line, col)

  return (
    <Fragment>
      {document.debug && (
        <div className="absolute top-0 left-0 print:hidden">
          {`(${row},${col}) -> ${index}+${virtual} ${affinity}`}
        </div>
      )}
      {focused && (
        <div
          id="cursor"
          key={`${rect.x}-${rect.y}`}
          className="absolute bg-black opacity-100 animate-caret-blink scroll-mb-[100px] print:hidden scroll-mt-[100px]"
          style={rectStyle(rect, document)}
        ></div>
      )}
    </Fragment>
  )
}

type HighlightSpan = { row: number; startCol: number; endCol: number } // inclusive endCol

function getHighlightSpans(
  start: GridPoint | null,
  end: GridPoint | null,
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
  document: DocumentStore
  layout: Layout
}
export const Highlight = (props: HighlightProps) => {
  const document = props.document
  const selectionStart = useCursorStore((s) => s.selectionStart)
  const selectionEnd = useCursorStore((s) => s.selectionEnd)

  if (!selectionStart || !selectionEnd) return null

  const linesPerPage = document.linesPerPage()
  const firstLine = props.pageIndex * linesPerPage

  const spans = getHighlightSpans(
    positionToGrid(props.layout, selectionStart),
    positionToGrid(props.layout, selectionEnd),
    document.columns,
  ).filter((x) => x.row >= firstLine && x.row < firstLine + linesPerPage)

  return (
    <>
      {spans.map((span) => (
        <div
          key={`${span.row}-${span.startCol}-${span.endCol}`}
          className="absolute bg-yellow-200 opacity-40 pointer-events-none print:hidden"
          style={rectStyle(
            spanRect(
              document,
              span.row - firstLine,
              span.startCol,
              span.endCol,
            ),
            document,
          )}
        />
      ))}
    </>
  )
}
