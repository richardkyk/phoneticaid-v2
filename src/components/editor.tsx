import { currentLayout, useCursorStore } from '@/lib/stores/cursor-store'
import { useDocumentStore } from '@/lib/stores/document-store'
import { useHistoryStore } from '@/lib/stores/history-store'
import { usePieceTableStore } from '@/lib/stores/piece-table-store'
import { useTranslateStore } from '@/lib/stores/translate-store'
import { hitTest, keyToCaretMove } from '@/lib/geometry'
import { useCameraStore } from '@/lib/stores/camera-store'
import { cn } from '@/lib/utils'
import { toDisplayScript } from '@/lib/script'
import { useProjectsStore } from '@/lib/stores/projects-store'
import { useLexiconStore } from '@/lib/hsk'
import { getText } from '@/lib/piece-table'
import { sentenceAt } from '@/lib/sentences'
import { getAnalysis } from '@/lib/words'
import { gridToPosition } from '@/lib/layout'
import { SelectionHandles } from './selection-handles'
import { useRevealStore } from '@/lib/stores/reveal-store'
import { useReadingsStore } from '@/lib/stores/readings-store'
import React, { Fragment, useCallback, useEffect, useMemo, useRef } from 'react'

const clamp = (val: number, min: number, max: number) =>
  Math.min(Math.max(val, min), max)

// The caret position (absolute row and col) for a point on a page's grid
const getRowColFromCoords = (
  x: number,
  y: number,
  pageIndex: number,
  pageRect: DOMRect,
): { row: number; col: number } => {
  const document = useDocumentStore.getState()
  const rowsCount = currentLayout().lines.length
  const linesPerPage = document.linesPerPage()

  // px -> mm at the current zoom
  const zoom = useCameraStore.getState().zoom
  const { line, slot } = hitTest(
    document,
    document.columns,
    (x - pageRect.left) / (document.mmX * zoom),
    (y - pageRect.top) / (document.mmY * zoom),
  )
  // points outside the page snap to its first/last line
  const lineInPage = clamp(line, 0, linesPerPage - 1)

  return {
    row: clamp(pageIndex * linesPerPage + lineInPage, 0, rowsCount - 1),
    col: slot,
  }
}

// The page whose grid is closest to `y` (pages are stacked vertically)
const findNearestPage = (viewportEl: HTMLElement, y: number) => {
  let nearest: { pageIndex: number; gridRect: DOMRect } | null = null
  let nearestDistance = Infinity
  for (const pageEl of viewportEl.querySelectorAll<HTMLElement>(
    '[data-page]',
  )) {
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

// The word containing the character at `index` (absolute offsets, end is
// exclusive), or just the character when it isn't in a word
const wordRange = (index: number): [number, number] => {
  const { pt, readings, pickedReadings } = useProjectsStore
    .getState()
    .getActiveProject()
  const lexicon = useLexiconStore.getState().lexicon
  const { words, wordAt } = getAnalysis(pt, lexicon, readings, pickedReadings)
  const word = words[wordAt[index]]
  return word ? [word.start, word.end] : [index, index + 1]
}

// The character whose pinyin is under the pointer, -1 for none (or when it
// has no pinyin)
const pinyinAt = (target: EventTarget) => {
  const el = (target as HTMLElement).closest<HTMLElement>('[data-pinyin]')
  if (!el) return -1
  const index = Number(el.dataset.index)
  if (!(index >= 0)) return -1
  const { pt, readings, pickedReadings } = useProjectsStore
    .getState()
    .getActiveProject()
  const lexicon = useLexiconStore.getState().lexicon
  const { pinyin } = getAnalysis(pt, lexicon, readings, pickedReadings)
  return pinyin[index] ? index : -1
}

interface EditorProps {
  children: React.ReactNode
  // the canvas the pages are drawn on
  viewportRef: React.RefObject<HTMLDivElement | null>
  className?: string
}
export const Editor: React.FC<EditorProps> = (props) => {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isSelectingRef = useRef(false)

  const pointerRef = useRef<{ x: number; y: number } | null>(null)
  const autoPanRef = useRef<number | null>(null)
  const lastPanTimeRef = useRef<number | null>(null)
  // the word a finger long pressed, which its selection grows from a word at
  // a time (so it doesn't shrink as the finger wobbles)
  const wordAnchorRef = useRef<[number, number] | null>(null)

  // the caret position (absolute offset) for a point, on the nearest page
  const indexAtPoint = useCallback((x: number, y: number) => {
    const viewportEl = props.viewportRef.current
    const page = viewportEl && findNearestPage(viewportEl, y)
    if (!page) return null
    const { row, col } = getRowColFromCoords(
      x,
      y,
      page.pageIndex,
      page.gridRect,
    )
    return gridToPosition(currentLayout(), row, col).index
  }, [])

  // extends the selection to the point under the pointer, using the nearest
  // page so the selection keeps tracking when the pointer leaves the pages
  const selectToPointer = useCallback(() => {
    const pointer = pointerRef.current
    const viewportEl = props.viewportRef.current
    if (!pointer || !viewportEl) return
    const anchor = wordAnchorRef.current
    if (anchor) {
      const index = indexAtPoint(pointer.x, pointer.y)
      if (index === null) return
      let [start, end] = anchor
      if (index > end) end = wordRange(index - 1)[1]
      else if (index < start) start = wordRange(index)[0]
      useCursorStore.getState().selectRange(start, end, false)
      return
    }

    const page = findNearestPage(viewportEl, pointer.y)
    if (!page) return

    const { row, col } = getRowColFromCoords(
      pointer.x,
      pointer.y,
      page.pageIndex,
      page.gridRect,
    )
    // the drag controls panning, so don't pan the caret into view
    useCursorStore.getState().setCursorByRowCol(row, col, false)
    useCursorStore.getState().setSelection(row, col, false)
    moveIMEInputToCursor(inputRef)
  }, [])

  // pans while the pointer is dragged outside the editor, faster the further
  // away it is
  const autoPan = useCallback(
    (time: number) => {
      autoPanRef.current = null
      const pointer = pointerRef.current
      const viewportEl = props.viewportRef.current
      const lastTime = lastPanTimeRef.current ?? time
      lastPanTimeRef.current = null
      if (!isSelectingRef.current || !pointer || !viewportEl) return

      const rect = viewportEl.getBoundingClientRect()
      const distance = (pos: number, start: number, end: number) =>
        pos < start ? pos - start : pos > end ? pos - end : 0
      const dx = distance(pointer.x, rect.left, rect.right)
      const dy = distance(pointer.y, rect.top, rect.bottom)
      if (dx === 0 && dy === 0) return

      // px per second, time based so the speed doesn't depend on the frame rate
      const elapsed = Math.min(time - lastTime, 100) / 1000
      useCameraStore
        .getState()
        .panBy(
          -clamp(dx * 10, -2000, 2000) * elapsed,
          -clamp(dy * 10, -2000, 2000) * elapsed,
        )
      selectToPointer()
      lastPanTimeRef.current = time
      autoPanRef.current = requestAnimationFrame(autoPan)
    },
    [selectToPointer],
  )

  // the pointer dragging out a selection (mouse, pen, or touch after a long
  // press)
  const selectingPointerRef = useRef<number | null>(null)

  const handleSelectMove = useCallback(
    (e: PointerEvent) => {
      if (e.pointerId !== selectingPointerRef.current) return
      pointerRef.current = { x: e.clientX, y: e.clientY }
      selectToPointer()
      if (autoPanRef.current === null) {
        autoPanRef.current = requestAnimationFrame(autoPan)
      }
    },
    [selectToPointer, autoPan],
  )

  const handleSelectEnd = useCallback(
    (e: PointerEvent) => {
      if (e.pointerId !== selectingPointerRef.current) return
      selectingPointerRef.current = null
      isSelectingRef.current = false
      wordAnchorRef.current = null
      pointerRef.current = null
      delete props.viewportRef.current?.dataset.selecting
      if (autoPanRef.current !== null) {
        cancelAnimationFrame(autoPanRef.current)
        autoPanRef.current = null
      }
      // a finger's selection is for reading, so the keyboard stays closed
      if (e.pointerType !== 'touch') {
        inputRef.current?.focus({ preventScroll: true })
      }
      useTranslateStore.getState().translateSelection()

      window.removeEventListener('pointermove', handleSelectMove)
      window.removeEventListener('pointerup', handleSelectEnd)
      window.removeEventListener('pointercancel', handleSelectEnd)
    },
    [handleSelectMove],
  )

  // the selection follows the pointer until it's lifted, a word at a time
  // when it's given the word it started from
  const followPointer = (pointerId: number, word?: [number, number]) => {
    selectingPointerRef.current = pointerId
    wordAnchorRef.current = word ?? null
    isSelectingRef.current = true
    // stops a touch from panning the canvas (see canvas.tsx)
    if (props.viewportRef.current)
      props.viewportRef.current.dataset.selecting = ''
    window.addEventListener('pointermove', handleSelectMove)
    window.addEventListener('pointerup', handleSelectEnd)
    window.addEventListener('pointercancel', handleSelectEnd)
  }

  // a tap puts the caret there, like a click
  const placeCaret = (x: number, y: number) => {
    const viewportEl = props.viewportRef.current
    const page = viewportEl && findNearestPage(viewportEl, y)
    if (!page) return
    const { row, col } = getRowColFromCoords(
      x,
      y,
      page.pageIndex,
      page.gridRect,
    )
    useCursorStore.getState().resetSelection()
    useCursorStore.getState().setCursorByRowCol(row, col, false)
    moveIMEInputToCursor(inputRef)
  }

  // closes the on-screen keyboard while a finger selects, so it doesn't
  // cover the translation
  const closeKeyboard = () => inputRef.current?.blur()

  const touch = useTouchGestures({ followPointer, placeCaret, closeKeyboard })

  const lastPointerTypeRef = useRef('')

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    lastPointerTypeRef.current = e.pointerType
    // other buttons (e.g. middle dragging to pan) don't select
    if (e.button !== 0) return
    const pageEl = (e.target as HTMLElement).closest(
      '[data-page]',
    ) as HTMLDivElement | null
    if (!pageEl) return // clicked outside a page
    const gridEl = pageEl.querySelector('[data-grid]')
    if (!gridEl) return // clicked outside a page

    useReadingsStore.getState().setPicking(null)
    // clicking pinyin picks its reading
    const pinyinIndex = e.pointerType === 'touch' ? -1 : pinyinAt(e.target)
    if (pinyinIndex >= 0) {
      useReadingsStore.getState().setPicking(pinyinIndex)
      return
    }

    // a finger pans, so selecting takes a long press (or a double tap)
    if (e.pointerType === 'touch') {
      touch.handlePointerDown(e)
      return
    }

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
    followPointer(e.pointerId)
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
    if (lastPointerTypeRef.current === 'touch') {
      // tapping off the pages closes the keyboard, as elsewhere on phones
      if (!(e.target as HTMLElement).closest('[data-page]')) {
        closeKeyboard()
        return
      }
      // the click after a finger selects (a double tap) would open the keyboard
      if (useCursorStore.getState().getSelection()) return
    }
    moveIMEInputToCursor(inputRef)
    inputRef.current?.focus({ preventScroll: true })
  }

  return (
    <Fragment>
      <div
        ref={props.viewportRef}
        id="editor"
        className={cn(
          'relative size-full touch-none select-none [-webkit-touch-callout:none] overflow-hidden outline-none cursor-grab data-[panning]:cursor-grabbing',
          props.className,
        )}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
      >
        {props.children}
      </div>
      <SelectionHandles indexAtPoint={indexAtPoint} />
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
  // arrow keys move visually, so their meaning depends on the writing mode
  const move = keyToCaretMove(useDocumentStore.getState().writingMode, e.key)
  if (move) {
    e.preventDefault()
    cursor.moveCursor(move)
    return
  }

  switch (e.key) {
    case 'Tab':
      e.preventDefault()
      cursor.moveCursor(e.shiftKey ? 'prevChar' : 'nextChar')
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
  const handleBlur = () => {
    setFocused(false)
    // iOS scrolls the page to keep a focused input above the keyboard, and
    // can leave it scrolled when the keyboard closes
    window.scrollTo(0, 0)
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
    // copied as it's drawn
    const text = toDisplayScript(
      usePieceTableStore.getState().extractSelection(),
      useDocumentStore.getState().script,
    )
    e.clipboardData.setData('text/plain', text)
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    usePieceTableStore.getState().insertAtCursor(text)
  }

  const handleCut = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    // copied as it's drawn
    const text = toDisplayScript(
      usePieceTableStore.getState().extractSelection(),
      useDocumentStore.getState().script,
    )
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
      inputEl.focus({ preventScroll: true })
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

// how long a finger rests before selecting, and how far it can move first
const LONG_PRESS_MS = 450
const TOUCH_SLOP = 10
// time and distance between the taps of a double tap
const DOUBLE_TAP_MS = 350
const DOUBLE_TAP_DISTANCE = 30

// the character under a touch, -1 for none
const cellIndex = (target: EventTarget) => {
  const el = (target as HTMLElement).closest<HTMLElement>('[data-index]')
  return el ? Number(el.dataset.index) : -1
}

// Selecting with a finger, which otherwise pans: a long press selects the
// word under it (dragging then extends the selection), and a double tap
// selects the sentence. Either is translated.
interface TouchActions {
  // the selection follows the pointer until it's lifted
  followPointer: (pointerId: number, word?: [number, number]) => void
  placeCaret: (x: number, y: number) => void
  closeKeyboard: () => void
}

function useTouchGestures(actions: TouchActions) {
  // the handlers are made once, so the listeners they add can be removed
  const actionsRef = useRef(actions)
  actionsRef.current = actions
  return useMemo(() => touchGestures(actionsRef), [])
}

function touchGestures(actionsRef: React.RefObject<TouchActions>) {
  let press: {
    pointerId: number
    x: number
    y: number
    index: number
    // the finger's on the character's pinyin
    onPinyin: boolean
    timer: number
  } | null = null
  let lastTap: { time: number; x: number; y: number } | null = null

  const cancelPress = () => {
    if (!press) return
    window.clearTimeout(press.timer)
    press = null
    window.removeEventListener('pointermove', handleMove)
    window.removeEventListener('pointerup', handleUp)
    window.removeEventListener('pointercancel', cancelPress)
  }

  const handleMove = (e: PointerEvent) => {
    if (!press || e.pointerId !== press.pointerId) return
    // it's a pan
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > TOUCH_SLOP) {
      lastTap = null
      cancelPress()
    }
  }

  const handleUp = (e: PointerEvent) => {
    if (!press || e.pointerId !== press.pointerId) return
    const { index, onPinyin } = press
    cancelPress()
    const now = performance.now()
    const doubleTap =
      lastTap &&
      now - lastTap.time < DOUBLE_TAP_MS &&
      Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) <
        DOUBLE_TAP_DISTANCE
    if (!doubleTap) {
      lastTap = { time: now, x: e.clientX, y: e.clientY }
      // tapping pinyin picks its reading
      if (onPinyin) useReadingsStore.getState().setPicking(index)
      else actionsRef.current.placeCaret(e.clientX, e.clientY)
      // reveals the word's pinyin and shows its dictionary card
      useRevealStore.getState().setHovered(index >= 0 ? index : null, onPinyin)
      return
    }
    lastTap = null
    if (index < 0) return
    const { pt } = useProjectsStore.getState().getActiveProject()
    const [start, end] = sentenceAt(getText(pt), index)
    if (start === end) return
    actionsRef.current.closeKeyboard()
    // the finger's on the page, so it isn't moved
    useCursorStore.getState().selectRange(start, end, false)
    useCursorStore.getState().setTouchSelection(true)
    useTranslateStore.getState().translateSelection()
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    // a second finger is a pinch
    if (press) {
      cancelPress()
      return
    }
    const index = cellIndex(e.target)
    const { pointerId } = e
    const timer = window.setTimeout(() => {
      cancelPress()
      lastTap = null
      if (index < 0) return
      const word = wordRange(index)
      actionsRef.current.closeKeyboard()
      useCursorStore.getState().selectRange(word[0], word[1], false)
      useCursorStore.getState().setTouchSelection(true)
      actionsRef.current.followPointer(pointerId, word)
    }, LONG_PRESS_MS)
    const onPinyin = pinyinAt(e.target) >= 0
    press = { pointerId, x: e.clientX, y: e.clientY, index, onPinyin, timer }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', cancelPress)
  }

  return { handlePointerDown }
}
