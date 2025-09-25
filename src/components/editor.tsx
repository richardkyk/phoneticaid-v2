import { useCursorStore } from '@/lib/cursor-store'
import { useDocumentStore, useRowsStore } from '@/lib/document-store'
import { usePieceTableStore } from '@/lib/piece-table-store'
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
  const inputRef = useRef<HTMLInputElement>(null)
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

interface HiddenInputProps {
  ref: React.RefObject<HTMLInputElement | null>
}
const HiddenInput = (props: HiddenInputProps) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
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

  const handleCut = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const text = usePieceTableStore.getState().extractSelection()
    e.clipboardData.setData('text/plain', text)
    usePieceTableStore.getState().deleteAtCursor(0)
  }

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const ev = e.nativeEvent as InputEvent
    if (ev.inputType === 'insertText' && ev.data) {
      e.preventDefault()
      usePieceTableStore.getState().insertAtCursor(ev.data)
      if (props.ref.current) props.ref.current.value = ''
    }
  }

  const handleCopy = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const text = usePieceTableStore.getState().extractSelection()
    e.clipboardData.setData('text/plain', text)
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    usePieceTableStore.getState().insertAtCursor(text)
  }

  const handleCompositionStart = (
    e: React.CompositionEvent<HTMLDivElement>,
  ) => {
    e.preventDefault()
    const cursorEl = document.getElementById('cursor')
    const inputEl = props.ref.current

    if (cursorEl && inputEl) {
      inputEl.focus()
      const rect = cursorEl.getBoundingClientRect()
      const height = 20
      inputEl.style.left = `${rect.left}px`
      inputEl.style.top = `${rect.bottom - height}px`
      inputEl.style.width = `${rect.height}px`
      inputEl.style.height = `${height}px`
      inputEl.style.opacity = '1'
    }
  }

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLDivElement>) => {
    e.preventDefault()
    const text = e.data
    usePieceTableStore.getState().insertAtCursor(text)
    const inputEl = props.ref.current
    if (inputEl) {
      inputEl.value = ''
      inputEl.style.opacity = '0'
    }
  }

  return (
    <input
      ref={props.ref}
      className="fixed bg-white text-xl w-[100px] opacity-0 shadow-[0_0_0_1px_rgba(0,0,0,0.1)] pointer-events-none focus:outline-amber-200"
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
