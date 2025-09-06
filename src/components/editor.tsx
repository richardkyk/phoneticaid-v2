import React, { useCallback } from 'react'

type EditorProps = {
  onInsertText: (text: string) => void
  onEnter: () => void
  onBackspace: () => void
  onDelete: () => void
  onArrow: (dir: 'left' | 'right' | 'up' | 'down') => void
  onHome: () => void
  onEnd: () => void
  onUndo: () => void
  onRedo: () => void
  onCopySelection: () => string // return selected text
  onDeleteSelection: () => void // delete selection when cutting
  onPasteText: (text: string) => void
}

export const Editor: React.FC<EditorProps> = (props) => {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          props.onArrow('left')
          break
        case 'ArrowRight':
          e.preventDefault()
          props.onArrow('right')
          break
        case 'ArrowUp':
          e.preventDefault()
          props.onArrow('up')
          break
        case 'ArrowDown':
          e.preventDefault()
          props.onArrow('down')
          break
        case 'Home':
          e.preventDefault()
          props.onHome()
          break
        case 'End':
          e.preventDefault()
          props.onEnd()
          break
        case 'Backspace':
          e.preventDefault()
          props.onBackspace()
          break
        case 'Delete':
          e.preventDefault()
          props.onDelete()
          break
        case 'Enter':
          e.preventDefault()
          props.onEnter()
          break
        case 'Tab':
          e.preventDefault()
          props.onInsertText('\t')
          break

        case 'z':
        case 'Z':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            e.shiftKey ? props.onRedo() : props.onUndo()
          }
          break
      }
    },
    [props],
  )

  const handleBeforeInput = useCallback(
    (e: React.FormEvent<HTMLDivElement>) => {
      const ev = e.nativeEvent as InputEvent
      if (ev.inputType === 'insertText') {
        e.preventDefault()
        props.onInsertText(ev.data ?? '')
      }
    },
    [props],
  )

  const handleCopy = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const text = props.onCopySelection()
      e.clipboardData.setData('text/plain', text)
      e.preventDefault()
    },
    [props],
  )

  const handleCut = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const text = props.onCopySelection()
      e.clipboardData.setData('text/plain', text)
      props.onDeleteSelection()
      e.preventDefault()
    },
    [props],
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const text = e.clipboardData.getData('text/plain')
      props.onPasteText(text)
      e.preventDefault()
    },
    [props],
  )

  return (
    <div
      contentEditable
      suppressContentEditableWarning
      className="editor"
      onKeyDown={handleKeyDown}
      onBeforeInput={handleBeforeInput}
      onCopy={handleCopy}
      onCut={handleCut}
      onPaste={handlePaste}
    />
  )
}
