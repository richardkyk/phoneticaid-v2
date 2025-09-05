import { buildRows } from '@/lib/render'
import {
  useCursorStore,
  useDocumentStore,
  usePieceTableStore,
} from '@/lib/store'
import { getMmToPx } from '@/lib/utils'
import { createFileRoute } from '@tanstack/react-router'
import { useRef } from 'react'

export const Route = createFileRoute('/')({
  component: App,
})

function App() {
  const document = useDocumentStore()

  const pt = usePieceTableStore((state) => state.pt)
  const insertRange = usePieceTableStore((state) => state.insertRange)
  const deleteRange = usePieceTableStore((state) => state.deleteRange)
  const rows = buildRows(pt, document)

  const { cursorVisible, cursorX, cursorY, updateCursor, moveCursor } =
    useCursorStore()

  const editorRef = useRef<HTMLDivElement>(null)

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!editorRef.current) return

    const { mmX, mmY } = getMmToPx()

    const rect = editorRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left - document.marginX * mmX
    const y = e.clientY - rect.top - document.marginY * mmY
    const row = Math.floor(y / ((document.fontSize + document.gapY) * mmY))
    const col = Math.floor(x / ((document.fontSize + document.gapX) * mmX))

    // if the user clicks in the gap between two rows, don't move the cursor
    const middleOfY =
      row * (document.fontSize + document.gapY) * mmY + document.fontSize * mmY
    const isUnderChar = y > middleOfY
    if (isUnderChar) return

    if (col < 0 || col >= document.columns) return
    if (row < 0 || row >= rows.length) return

    // place the cursor at the end of the character if the user clicks on the right side of the character
    const middleOfX =
      col * (document.fontSize + document.gapX) * mmX +
      (document.fontSize / 2) * mmX
    const isCharRightSide = x > middleOfX
    updateCursor(row, isCharRightSide ? col + 1 : col)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!editorRef.current) return

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      moveCursor(e.key)
      return
    }
    if (e.key === 'Enter') {
      insertRange('\n')
      return
    }
    if (e.key === 'Backspace') {
      deleteRange(1)
      return
    }
  }

  return (
    <div className="container mx-auto p-6 flex items-center justify-center">
      <div
        tabIndex={0}
        className="relative shadow-[0_0_0_1px_rgba(0,0,0,0.1)] w-[210mm] h-[297mm] outline-none"
        ref={editorRef}
        onMouseDown={handleMouseDown}
        onKeyDown={handleKeyDown}
      >
        {/* Margins */}
        <div
          className="border-x border-dashed absolute inset-y-0"
          style={{
            insetInline: `${document.marginX}mm`,
          }}
        ></div>
        <div
          className="border-y border-dashed absolute inset-x-0"
          style={{
            insetBlock: `${document.marginY}mm`,
          }}
        ></div>

        {cursorVisible && (
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

        {/* Content */}
        {rows.map((row, i) =>
          row.map((cell, j) => (
            <div
              key={`${i}-${j}`}
              className="absolute overflow-hidden flex items-center justify-center shadow-[0_0_0_1px_rgba(0,0,0,0.05)] text-gray-600 cursor-text"
              style={{
                top: `${cell.y}mm`,
                left: `${cell.x}mm`,
                width: `${cell.width}mm`,
                height: `${cell.height}mm`,
              }}
            >
              <span style={{ fontSize: `${cell.height}mm` }}>
                {cell.content}
              </span>
            </div>
          )),
        )}

        {/* {rows.map((row, i) => { */}
        {/*   const _row = { */}
        {/*     pieces: row.pieces, */}
        {/*     originalBuffer, */}
        {/*     addBuffer, */}
        {/*   } */}
        {/*   const cells = renderRow(i, _row, document) */}
        {/*   return ( */}
        {/*     <div key={i} className=""> */}
        {/*       {cells.map((cell, j) => { */}
        {/*         return ( */}
        {/*           <div */}
        {/*             key={`${i}-${j}`} */}
        {/*             className="absolute overflow-hidden flex items-center justify-center shadow-[0_0_0_1px_rgba(0,0,0,0.05)] text-gray-600 cursor-text" */}
        {/*             style={{ */}
        {/*               top: `${cell.y}mm`, */}
        {/*               left: `${cell.x}mm`, */}
        {/*               width: `${cell.width}mm`, */}
        {/*               height: `${cell.height}mm`, */}
        {/*             }} */}
        {/*           > */}
        {/*             <span */}
        {/*               style={{ */}
        {/*                 fontSize: `${cell.height}mm`, */}
        {/*               }} */}
        {/*             > */}
        {/*               {cell.content} */}
        {/*             </span> */}
        {/*           </div> */}
        {/*         ) */}
        {/*       })} */}
        {/*     </div> */}
        {/*   ) */}
        {/* })} */}
      </div>
    </div>
  )
}
