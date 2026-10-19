import { currentLayout, useCursorStore } from '@/lib/stores/cursor-store'
import { useDocumentStore } from '@/lib/stores/document-store'
import { useHistoryStore } from '@/lib/stores/history-store'
import { usePieceTableStore } from '@/lib/stores/piece-table-store'
import { useTranslateStore } from '@/lib/stores/translate-store'
import React, { Fragment, useCallback, useEffect, useRef } from 'react'
import { ScrollArea, ScrollBar } from './ui/scroll-area'

const clamp = (val: number, min: number, max: number) =>
  Math.min(Math.max(val, min), max)

const getRowColFromCoords = (
  x: number,
  y: number,
  pageIndex: number,
  pageRect: DOMRect,
): { row: number; col: number } => {
  const document = useDocumentStore.getState()
  const rowsCount = currentLayout().lines.length

  const relX = x - pageRect.left - document.marginX * document.mmX
  const relY = y - pageRect.top - document.marginY * document.mmY

  const rowHeight = document.rowHeight() * document.mmY
  const colWidth = (document.fontSize + document.gapX) * document.mmX

  const rowsPerPage = document.rowsPerPage()

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

// The page whose grid is closest to `y` (pages are stacked vertically)
const findNearestPage = (scrollEl: HTMLElement, y: number) => {
  let nearest: { pageIndex: number; gridRect: DOMRect } | null = null
  let nearestDistance = Infinity
  for (const pageEl of scrollEl.querySelectorAll<HTMLElement>('[data-page]')) {
    const gridEl = pageEl.querySelector('[data-grid]')
    if (!gridEl) continue
    const gridRect = gridEl.getBoundingClientRect()
    const distance =
      y < gridRect.top
        ? gridRect.top - y
        : y > gridRect.bottom
          ? y - gridRect.bottom
          : 0
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearest = {
        pageIndex: parseInt(pageEl.dataset.page ?? '0', 10),
        gridRect,
      }
    }
  }
  return nearest
}

interface EditorProps {
  children: React.ReactNode
  scrollRef: React.RefObject<HTMLDivElement | null>
}
export const Editor: React.FC<EditorProps> = (props) => {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isSelectingRef = useRef(false)

  const pointerRef = useRef<{ x: number; y: number } | null>(null)
  const autoScrollRef = useRef<number | null>(null)
  const lastScrollTimeRef = useRef<number | null>(null)

  // extends the selection to the point under the pointer, using the nearest
  // page so the selection keeps tracking when the pointer leaves the pages
  const selectToPointer = useCallback(() => {
    const pointer = pointerRef.current
    const scrollEl = props.scrollRef.current
    if (!pointer || !scrollEl) return
    const page = findNearestPage(scrollEl, pointer.y)
    if (!page) return

    const { row, col } = getRowColFromCoords(
      pointer.x,
      pointer.y,
      page.pageIndex,
      page.gridRect,
    )
    // the drag controls scrolling, so don't scroll the caret into view
    useCursorStore.getState().setCursorByRowCol(row, col, false)
    useCursorStore.getState().setSelection(row, col, false)
    moveIMEInputToCursor(inputRef)
  }, [])

  // scrolls while the pointer is dragged above or below the editor, faster
  // the further away it is
  const autoScroll = useCallback(
    (time: number) => {
      autoScrollRef.current = null
      const pointer = pointerRef.current
      const scrollEl = props.scrollRef.current
      const lastTime = lastScrollTimeRef.current ?? time
      lastScrollTimeRef.current = null
      if (!isSelectingRef.current || !pointer || !scrollEl) return

      const rect = scrollEl.getBoundingClientRect()
      const distance =
        pointer.y < rect.top
          ? pointer.y - rect.top
          : pointer.y > rect.bottom
            ? pointer.y - rect.bottom
            : 0
      if (distance === 0) return

      // px per second, time based so the speed doesn't depend on the frame rate
      const speed = clamp(distance * 10, -2000, 2000)
      scrollEl.scrollTop += (speed * Math.min(time - lastTime, 100)) / 1000
      selectToPointer()
      lastScrollTimeRef.current = time
      autoScrollRef.current = requestAnimationFrame(autoScroll)
    },
    [selectToPointer],
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isSelectingRef.current) return
      pointerRef.current = { x: e.clientX, y: e.clientY }
      selectToPointer()
      if (autoScrollRef.current === null) {
        autoScrollRef.current = requestAnimationFrame(autoScroll)
      }
    },
    [selectToPointer, autoScroll],
  )

  const handleMouseUp = useCallback(() => {
    isSelectingRef.current = false
    pointerRef.current = null
    if (autoScrollRef.current !== null) {
      cancelAnimationFrame(autoScrollRef.current)
      autoScrollRef.current = null
    }
    inputRef.current?.focus()
    useTranslateStore.getState().translateSelection()

    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
  }, [handleMouseMove])

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!props.scrollRef.current) return
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

  useEffect(() => {
    const focusInput = () => inputRef.current?.focus({ preventScroll: true })

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !shouldRedirectKey(e)) return
      focusInput()
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // the browser doesn't reliably deliver the typed character to the
        // newly focused input, so insert it ourselves
        e.preventDefault()
        usePieceTableStore.getState().insertAtCursor(e.key)
        return
      }
      // shortcuts are handled here, pastes follow the focus to the input
      handleEditorKeyDown(e, inputRef)
    }
    // pastes that don't land in a text field (e.g. on the page background)
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement
      if (
        e.defaultPrevented ||
        target.closest('input, textarea, select, [contenteditable]')
      ) {
        return
      }
      e.preventDefault()
      focusInput()
      usePieceTableStore
        .getState()
        .insertAtCursor(e.clipboardData?.getData('text/plain') ?? '')
    }
    const handleWindowFocus = () => {
      if (document.activeElement === document.body) focusInput()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('paste', handlePaste)
    window.addEventListener('focus', handleWindowFocus)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('paste', handlePaste)
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [])

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    moveIMEInputToCursor(inputRef)
    inputRef.current?.focus()
  }

  return (
    <Fragment>
      <ScrollArea
        className="w-full h-[calc(100vh-40px-32px+16px)]" // header-height and 2x margin
        ref={props.scrollRef}
      >
        <div
          id="editor"
          className="outline-none print:h-screen"
          onMouseDown={handleMouseDown}
          onClick={handleClick}
        >
          {props.children}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
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

const handleEditorKeyDown = (
  e: KeyboardEvent | React.KeyboardEvent,
  inputRef: React.RefObject<HTMLTextAreaElement | null>,
) => {
  moveIMEInputToCursor(inputRef)
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

// Keystrokes on the page background (e.g. right after the page loads) or on a
// toolbar button are sent to the editor, while keys those buttons use
// themselves (Enter, Space, arrows) and real inputs are left alone
const shouldRedirectKey = (e: KeyboardEvent) => {
  const target = document.activeElement
  if (!target || target === document.body) return e.key !== 'Tab'
  if (
    target instanceof HTMLButtonElement &&
    !target.closest('[role=menu], [role=dialog], [role=listbox]')
  ) {
    return (e.key.length === 1 && e.key !== ' ') || e.key === 'Backspace'
  }
  return false
}

interface HiddenInputProps {
  ref: React.RefObject<HTMLTextAreaElement | null>
}
const HiddenInput = (props: HiddenInputProps) => {
  const setFocused = useCursorStore((state) => state.setFocused)

  useEffect(() => {
    // autoFocus may have focused the input before React attached the focus handler
    setFocused(
      document.activeElement === props.ref.current && document.hasFocus(),
    )
  }, [])

  const handleFocus = () => {
    setFocused(true)
    moveIMEInputToCursor(props.ref)
  }
  const handleBlur = () => setFocused(false)

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
      onKeyDown={(e) => handleEditorKeyDown(e, props.ref)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onInput={handleInput}
      onCopy={handleCopy}
      onPaste={handlePaste}
      onCut={handleCut}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
    />
  )
}
