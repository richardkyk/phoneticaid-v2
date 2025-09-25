import { useCursorStore } from '@/lib/stores/cursor-store'
import { useDocumentStore, useRowsStore } from '@/lib/stores/document-store'
import { usePieceTableStore } from '@/lib/stores/piece-table-store'
import React, { Fragment, useRef } from 'react'

const getRowColFromMouseEvent = (e: React.MouseEvent<HTMLDivElement>) => {
  const document = useDocumentStore.getState()
  const rowsCount = useRowsStore.getState().rows

  const rect = e.currentTarget.getBoundingClientRect()
  const x = e.clientX - rect.left - document.marginX * document.mmX
  const y = e.clientY - rect.top - document.marginY * document.mmY
  const row = Math.floor(
    y / ((document.fontSize + document.gapY) * document.mmY),
  )
  const col = Math.floor(
    x / ((document.fontSize + document.gapX) * document.mmX),
  )

  const middleOfY =
    row * (document.fontSize + document.gapY) * document.mmY +
    document.fontSize * document.mmY
  const isUnderChar = y > middleOfY
  if (isUnderChar) return

  if (col < 0 || col >= document.columns) return
  if (row < 0 || row >= rowsCount) return

  const middleOfX =
    col * (document.fontSize + document.gapX) * document.mmX +
    (document.fontSize / 2) * document.mmX
  const isCharRightSide = x > middleOfX
  return { row, col: isCharRightSide ? col + 1 : col }
}

export const Editor: React.FC<{ children: React.ReactNode }> = (props) => {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const isSelectingRef = useRef(false)

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!editorRef.current) return
    isSelectingRef.current = true
    useCursorStore.getState().resetSelection()

    const pos = getRowColFromMouseEvent(e)
    if (!pos) return
    const { row, col } = pos
    useCursorStore.getState().setCursorByRowCol(row, col)
    useCursorStore.getState().setSelection(row, col, true)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelectingRef.current || !editorRef.current) return

    const pos = getRowColFromMouseEvent(e)
    if (!pos) return
    const { row, col } = pos
    useCursorStore.getState().setSelection(row, col, false)
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    isSelectingRef.current = false
    const pos = getRowColFromMouseEvent(e)
    if (!pos) return
    const { row, col } = pos
    useCursorStore.getState().setCursorByRowCol(row, col)
  }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    moveIMEInputToCursor(inputRef)
    inputRef.current?.focus()
  }

  return (
    <Fragment>
      <div
        ref={editorRef}
        className="relative shrink-0 shadow-[0_0_0_1px_rgba(0,0,0,0.1)] w-[210mm] select-none h-[297mm] outline-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
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
      // case 'z':
      // case 'Z':
      //   if (e.metaKey || e.ctrlKey) {
      //     e.preventDefault()
      //     e.shiftKey ? props.onRedo() : props.onUndo()
      //   }
      //   break
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
      ref={props.ref}
      className="fixed resize-none bg-white text-xl w-[100px] opacity-0 shadow-[0_0_0_1px_rgba(0,0,0,0.1)] pointer-events-none focus:outline-amber-200"
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
