import { useCursorStore } from '@/lib/cursor-store'
import { useDocumentStore, useRowsStore } from '@/lib/document-store'
import { usePieceTableStore } from '@/lib/piece-table-store'
import { getMmToPx } from '@/lib/utils'
import React, { Fragment, useRef } from 'react'

export const Editor: React.FC<{ children: React.ReactNode }> = (props) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
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
    if (row < 0 || row > rowsCount) return

    // place the cursor at the end of the character if the user clicks on the right side of the character
    const middleOfX =
      col * (document.fontSize + document.gapX) * mmX +
      (document.fontSize / 2) * mmX
    const isCharRightSide = x > middleOfX
    cursor.setCursorByRowCol(row, isCharRightSide ? col + 1 : col)
  }

  const handleClick = () => {
    inputRef.current?.focus()
  }

  return (
    <Fragment>
      <div
        ref={editorRef}
        className="relative shrink-0 shadow-[0_0_0_1px_rgba(0,0,0,0.1)] w-[210mm] h-[297mm] outline-none"
        onMouseDown={handleMouseDown}
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

  // const handleCopy =
  //   (e: React.ClipboardEvent<HTMLDivElement>) => {
  //     const text = props.onCopySelection()
  //     e.clipboardData.setData('text/plain', text)
  //     e.preventDefault()
  //   }
  //
  // const handleCut =
  //   (e: React.ClipboardEvent<HTMLDivElement>) => {
  //     const text = props.onCopySelection()
  //     e.clipboardData.setData('text/plain', text)
  //     props.onDeleteSelection()
  //     e.preventDefault()
  // }
  //

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const ev = e.nativeEvent as InputEvent
    if (ev.inputType === 'insertText' && ev.data) {
      e.preventDefault()
      usePieceTableStore.getState().insertAtCursor(ev.data)
      if (props.ref.current) props.ref.current.value = ''
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    usePieceTableStore.getState().insertAtCursor(text)
  }

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLDivElement>) => {
    e.preventDefault()
    const text = e.data
    usePieceTableStore.getState().insertAtCursor(text)
    if (props.ref.current) props.ref.current.value = ''
  }
  return (
    <input
      ref={props.ref}
      className="absolute -top-1 w-[210mm] opacity-100 shadow-[0_0_0_1px_rgba(0,0,0,0.1)] pointer-events-none focus:outline-amber-200"
      onKeyDown={handleKeyDown}
      onInput={handleInput}
      onPaste={handlePaste}
      onCompositionEnd={handleCompositionEnd}
    />
  )
}
