import { useCursorStore, useMapStore } from '@/lib/cursor-store'
import { usePieceTableStore } from '@/lib/piece-table-store'
import { buildRows } from '@/lib/render'
import { useDocumentStore, useRowsStore } from '@/lib/document-store'
import { cn } from '@/lib/utils'
import { Fragment } from 'react/jsx-runtime'
import { useLayoutEffect } from '@tanstack/react-router'

export const Grid = () => {
  const document = useDocumentStore()
  const pt = usePieceTableStore((state) => state.pt)
  const data = buildRows(pt, document)

  useLayoutEffect(() => {
    useRowsStore.getState().setRows(data.rowCount + 1)
    useMapStore.getState().setPieceMap(data.pieceMap)
    useMapStore.getState().setGridMap(data.gridMap)
  }, [data])

  return data.rows.map((row, i) =>
    row.map((cell, j) => (
      <div
        key={`${i}-${j}`}
        data-last={cell.col === document.columns ? '' : undefined}
        className={cn(
          'absolute overflow-hidden flex items-center justify-center shadow-[0_0_0_1px_rgba(0,0,0,0.05)] text-gray-600 cursor-text',
          'data-[last]:bg-[repeating-linear-gradient(135deg,theme(colors.gray.200),theme(colors.gray.200)_5px,transparent_5px,transparent_10px)]',
        )}
        style={{
          top: `${cell.y}mm`,
          left: `${cell.x}mm`,
          width: `${cell.width}mm`,
          height: `${cell.height}mm`,
          opacity: document.debug ? 1 : 0,
        }}
      >
        {document.debug && (
          <Fragment>
            <div className="absolute text-[10px] left-0 top-0">
              ({i},{j})
            </div>
            <div className="absolute text-[10px] left-0 bottom-0">
              {cell.pieceIndex === -1
                ? `+${cell.charIndex}`
                : `[${cell.pieceIndex}][${cell.charIndex}]`}
            </div>
          </Fragment>
        )}
        <span style={{ fontSize: `${cell.height}mm` }}>{cell.content}</span>
      </div>
    )),
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

export const Cursor = () => {
  const gapX = useDocumentStore((state) => state.gapX)
  const fontSize = useDocumentStore((state) => state.fontSize)

  const pieceIndex = useCursorStore((state) => state.pieceIndex)
  const charIndex = useCursorStore((state) => state.charIndex)
  const offset = useCursorStore((state) => state.offset)

  const pieceMap = useMapStore((state) => state.pieceMap)

  const pos = pieceMap.get(`${pieceIndex}:${charIndex}`)
  const [row, col] = (pos ?? '0:0').split(':')

  const visible = useCursorStore((state) => state.visible)

  const document = useDocumentStore.getState()

  const cursorX =
    document.marginX +
    (parseInt(col) + offset) * (document.gapX + document.fontSize)
  const cursorY =
    document.marginY + parseInt(row) * (document.gapY + document.fontSize)

  return (
    <Fragment>
      {visible && (
        <div
          key={`${cursorX}-${cursorY}-${gapX}`}
          className="absolute bg-black opacity-100 animate-caret-blink"
          style={{
            top: `${cursorY}mm`,
            left: `${cursorX}mm`,
            width: `max(${gapX}mm, 2px)`,
            height: `${fontSize}mm`,
            transform: `translateX(-100%)`,
          }}
        ></div>
      )}
    </Fragment>
  )
}
