import { useCursorStore, useMapStore } from '@/lib/cursor-store'
import { usePieceTableStore } from '@/lib/piece-table-store'
import { buildRows } from '@/lib/render'
import {
  DocumentState,
  useDocumentStore,
  useRowsStore,
} from '@/lib/document-store'
import { cn } from '@/lib/utils'
import { Fragment } from 'react/jsx-runtime'
import { useLayoutEffect } from '@tanstack/react-router'
import { getCursorPosition } from '@/lib/piece-table'

export const Grid = () => {
  const document = useDocumentStore()
  const pt = usePieceTableStore((state) => state.pt)
  const data = buildRows(pt, document)

  useLayoutEffect(() => {
    useRowsStore.getState().setRows(data.rowCount + 1)
    useMapStore.getState().setPieceMap(data.pieceMap)
    useMapStore.getState().setGridMap(data.gridMap)
  }, [data])

  return (
    <Fragment>
      {data.rows.map((row, i) =>
        row.map((cell, j) => (
          <div
            key={`${i}-${j}`}
            data-debug={document.debug ? '' : undefined}
            data-last={cell.col === document.columns ? '' : undefined}
            data-odd={
              document.debug && cell.pieceIndex % 2 === 0 ? '' : undefined
            }
            data-even={
              document.debug && cell.pieceIndex % 2 === 1 ? '' : undefined
            }
            className={cn(
              'absolute overflow-hidden data-[last]:opacity-0 data-[odd]:bg-blue-100 data-[even]:bg-red-100 [[data-debug][data-last]]:opacity-100 flex items-center justify-center shadow-[0_0_0_1px_rgba(0,0,0,0.05)] text-gray-600 cursor-text',
              'data-[last]:bg-[repeating-linear-gradient(135deg,theme(colors.gray.200),theme(colors.gray.200)_5px,transparent_5px,transparent_10px)]',
            )}
            style={{
              top: `${cell.y}mm`,
              left: `${cell.x}mm`,
              width: `${cell.width}mm`,
              height: `${cell.height}mm`,
            }}
          >
            <span style={{ fontSize: `${cell.height}mm` }}>{cell.content}</span>
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
        )),
      )}
      <Cursor document={document} pieceMap={data.pieceMap} />
    </Fragment>
  )
}

export const Margins = () => {
  const marginX = useDocumentStore((state) => state.marginX)
  const marginY = useDocumentStore((state) => state.marginY)

  return (
    <Fragment>
      {/* Margins */}
      <div
        className="border-x border-dashed absolute inset-y-0"
        style={{
          insetInline: `${marginX}mm`,
        }}
      ></div>
      <div
        className="border-y border-dashed absolute inset-x-0"
        style={{
          insetBlock: `${marginY}mm`,
        }}
      ></div>
    </Fragment>
  )
}

interface CursorProps {
  document: DocumentState
  pieceMap: Map<string, string>
}
export const Cursor = (props: CursorProps) => {
  const { document, pieceMap } = props

  const visible = useCursorStore((state) => state.visible)
  let pieceIndex = useCursorStore((state) => state.pieceIndex)
  let charIndex = useCursorStore((state) => state.charIndex)
  let offset = useCursorStore((state) => state.offset)

  let { row, col, isNewLine } = getCursorPosition(
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

  const cursorX = document.marginX + col * (document.gapX + document.fontSize)
  const cursorY = document.marginY + row * (document.gapY + document.fontSize)

  return (
    <Fragment>
      {document.debug && (
        <div className="absolute top-0 left-0">
          {`(${row},${col}) -> [${pieceIndex}][${charIndex}]+${offset}_${isNewLine}`}
        </div>
      )}
      {visible && (
        <div
          key={`${cursorX}-${cursorY}-${document.gapX}`}
          className="absolute bg-black opacity-100 animate-caret-blink"
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
