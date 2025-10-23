import { useCursorStore } from '@/lib/stores/cursor-store'
import { useDocumentStore, useRowsStore } from '@/lib/stores/document-store'
import { useHistoryStore } from '@/lib/stores/history-store'
import { usePieceTableStore } from '@/lib/stores/piece-table-store'
import React, { Fragment, useCallback, useRef } from 'react'

const clamp = (val: number, min: number, max: number) =>
  Math.min(Math.max(val, min), max)

const getRowColFromCoords = (
  x: number,
  y: number,
  pageIndex: number,
  pageRect: DOMRect,
): { row: number; col: number } => {
  const document = useDocumentStore.getState()
  const rowsCount = useRowsStore.getState().rows

  const relX = x - pageRect.left - document.marginX * document.mmX
  const relY = y - pageRect.top - document.marginY * document.mmY

  const pinyinHeight = document.pinyinSize + document.pinyinOffset
  const rowHeight =
    (document.fontSize + document.gapY + pinyinHeight) * document.mmY
  const colWidth = (document.fontSize + document.gapX) * document.mmX

  const rowsPerPage = Math.floor(
    (document.pageHeight * document.mmY - document.marginY * 2 * document.mmY) /
      rowHeight,
  )

  const rowInPage = Math.floor(relY / rowHeight)
  const colInPage = Math.floor(relX / colWidth)

  let row = rowInPage + pageIndex * rowsPerPage
  let col = colInPage

  if (rowInPage >= rowsPerPage) {
    row = (pageIndex + 1) * rowsPerPage - 1
  } else if (rowInPage <= 0) {
    row = pageIndex * rowsPerPage
  }

  row = clamp(row, 0, rowsCount - 1)
  col = clamp(col, 0, document.columns - 1)

  const middleOfX = col * colWidth + (document.fontSize / 2) * document.mmX
  const isCharRightSide = relX > middleOfX

  return {
    row, // absolute row across the document
    col: isCharRightSide ? col + 1 : col,
  }
}

export const Editor: React.FC<{ children: React.ReactNode }> = (props) => {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const isSelectingRef = useRef(false)

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isSelectingRef.current || !editorRef.current) return
    const pageEl = (e.target as HTMLElement).closest(
      '[data-page]',
    ) as HTMLDivElement | null
    if (!pageEl) return // clicked outside a page
    const gridEl = pageEl.querySelector('[data-grid]')
    if (!gridEl) return // clicked outside a page

    const gridRect = gridEl.getBoundingClientRect()
    const pageIndex = parseInt(pageEl.dataset.page ?? '0', 10)
    const { row, col } = getRowColFromCoords(
      e.clientX,
      e.clientY,
      pageIndex,
      gridRect,
    )
    useCursorStore.getState().setCursorByRowCol(row, col)
    useCursorStore.getState().setSelection(row, col, false)
    moveIMEInputToCursor(inputRef)
  }, [])

  const handleMouseUp = useCallback(() => {
    isSelectingRef.current = false
    inputRef.current?.focus()

    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
  }, [handleMouseMove])

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!editorRef.current) return
    const pageEl = (e.target as HTMLElement).closest(
      '[data-page]',
    ) as HTMLDivElement | null
    if (!pageEl) return // clicked outside a page
    const gridEl = pageEl.querySelector('[data-grid]')
    if (!gridEl) return // clicked outside a page

    isSelectingRef.current = true
    useCursorStore.getState().resetSelection()

    const gridRect = gridEl.getBoundingClientRect()
    const pageIndex = parseInt(pageEl.dataset.page ?? '0', 10)
    const { row, col } = getRowColFromCoords(
      e.clientX,
      e.clientY,
      pageIndex,
      gridRect,
    )
    useCursorStore.getState().setCursorByRowCol(row, col)
    useCursorStore.getState().setSelection(row, col, true)

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    moveIMEInputToCursor(inputRef)
    inputRef.current?.focus()
  }

  return (
    <Fragment>
      <div
        id="editor"
        ref={editorRef}
        className="outline-none h-[calc(100vh-100px)] overflow-y-scroll"
        onMouseDown={handleMouseDown}
        onClick={handleClick}
      >
        {props.children}
      </div>
      <HiddenInput ref={inputRef} />
    </Fragment>
  )
}

const moveIMEInputToCursor = (
  inputEl: React.RefObject<HTMLTextAreaElement | null>,
) => {
  requestAnimationFrame(() => {
    const cursorEl = document.getElementById('cursor')
    if (cursorEl && inputEl.current) {
      const rect = cursorEl.getBoundingClientRect()
      const height = 20
      inputEl.current.style.left = `${rect.left}px`
      inputEl.current.style.top = `${rect.bottom - height}px`
      inputEl.current.style.width = `100px`
      inputEl.current.style.height = `${height}px`
    }
  })
}

interface HiddenInputProps {
  ref: React.RefObject<HTMLTextAreaElement | null>
}
const HiddenInput = (props: HiddenInputProps) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    moveIMEInputToCursor(props.ref)
    const cursor = useCursorStore.getState()
    const pieceTable = usePieceTableStore.getState()
    const history = useHistoryStore.getState()
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown':
      case 'Home':
      case 'End':
        e.preventDefault()
        cursor.moveCursor(e.key)
        break
      case 'Tab':
        e.preventDefault()
        if (e.shiftKey) {
          cursor.moveCursor('ArrowLeft')
        } else {
          cursor.moveCursor('ArrowRight')
        }
        break
      case 'Backspace':
        e.preventDefault()
        pieceTable.deleteAtCursor(1)
        break
      // case 'Delete':
      //   e.preventDefault()
      //   break
      case 'Enter':
        e.preventDefault()
        pieceTable.insertAtCursor('\n')
        break
      case 'z':
      case 'Z':
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault()
          e.shiftKey ? history.redo() : history.undo()
        }
        break
      case 'a':
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault()
          cursor.selectAll()
        }
        break
    }
  }

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const ev = e.nativeEvent as InputEvent
    if (ev.inputType === 'insertText' && ev.data) {
      e.preventDefault()
      usePieceTableStore.getState().insertAtCursor(ev.data)
      if (props.ref.current) props.ref.current.value = ''
    }
  }

  const handleCopy = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    const text = usePieceTableStore.getState().extractSelection()
    e.clipboardData.setData('text/plain', text)
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    usePieceTableStore.getState().insertAtCursor(text)
  }

  const handleCut = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    const text = usePieceTableStore.getState().extractSelection()
    e.clipboardData.setData('text/plain', text)
    usePieceTableStore.getState().deleteAtCursor(0)
  }

  const handleCompositionStart = (
    e: React.CompositionEvent<HTMLTextAreaElement>,
  ) => {
    e.preventDefault()
    const inputEl = props.ref.current
    if (inputEl) {
      inputEl.style.opacity = '1'
      inputEl.focus()
    }
  }

  const handleCompositionEnd = (
    e: React.CompositionEvent<HTMLTextAreaElement>,
  ) => {
    e.preventDefault()
    const text = e.data
    if (text.length !== 0) {
      usePieceTableStore.getState().insertAtCursor(text)
    }
    const inputEl = props.ref.current
    if (inputEl) {
      inputEl.value = ''
      inputEl.style.opacity = '0'
    }
  }

  return (
    <textarea
      autoFocus
      ref={props.ref}
      className="fixed resize-none bg-white text-xl w-[100px] focus:border-red-500 opacity-0 shadow-[0_0_0_1px_rgba(0,0,0,0.1)] pointer-events-none focus:outline-amber-200"
      rows={1}
      onKeyDown={handleKeyDown}
      onInput={handleInput}
      onCopy={handleCopy}
      onPaste={handlePaste}
      onCut={handleCut}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
    />
  )
}
