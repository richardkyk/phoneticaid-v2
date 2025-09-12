import { Grid, Margins } from '@/components/grid'
import { useCursorStore } from '@/lib/cursor-store'
import { useDocumentStore, useRowsStore } from '@/lib/document-store'
import { usePieceTableStore } from '@/lib/piece-table-store'
import { getMmToPx } from '@/lib/utils'
import { createFileRoute } from '@tanstack/react-router'
import { useRef } from 'react'

export const Route = createFileRoute('/')({
  component: App,
})

function App() {
  const editorRef = useRef<HTMLDivElement>(null)

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!editorRef.current) return

    const document = useDocumentStore.getState()
    const cursor = useCursorStore.getState()
    const rowsCount = useRowsStore.getState().rows

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
    if (row < 0 || row >= rowsCount) return

    // place the cursor at the end of the character if the user clicks on the right side of the character
    const middleOfX =
      col * (document.fontSize + document.gapX) * mmX +
      (document.fontSize / 2) * mmX
    const isCharRightSide = x > middleOfX
    cursor.setCursorByRowCol(row, isCharRightSide ? col + 1 : col)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!editorRef.current) return

    const pieceTable = usePieceTableStore.getState()
    const cursor = useCursorStore.getState()

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      cursor.moveCursor(e.key)
      return
    }
    if (e.key === 'Enter') {
      pieceTable.insertAtCursor('XX')
      return
    }
    if (e.key === 'Backspace') {
      pieceTable.deleteAtCursor(1)
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
        <Margins />
        {/* Content */}
        <Grid />
      </div>
    </div>
  )
}
