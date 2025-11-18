import { useRef } from 'react'

const PADDING = 8

export function useDraggableOverlay() {
  const overlayRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()

    const overlay = overlayRef.current
    if (!overlay) return

    const rect = overlay.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top

    const handleMove = (moveEvent: MouseEvent) => {
      if (!overlay) return

      const vw = window.innerWidth
      const vh = window.innerHeight

      let newLeft = moveEvent.clientX - offsetX - PADDING
      let newTop = moveEvent.clientY - offsetY - PADDING

      newLeft = Math.max(PADDING, Math.min(newLeft, vw - rect.width - PADDING))
      newTop = Math.max(PADDING, Math.min(newTop, vh - rect.height - PADDING))

      overlay.style.left = `${newLeft}px`
      overlay.style.top = `${newTop}px`
    }

    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
    }

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
  }

  const startResize = (
    e: React.MouseEvent,
    direction: 'right' | 'bottom' | 'corner',
  ) => {
    e.preventDefault()
    e.stopPropagation()

    const overlay = overlayRef.current
    if (!overlay) return

    const startX = e.clientX
    const startY = e.clientY

    const startWidth = overlay.offsetWidth
    const startHeight = overlay.offsetHeight

    const handleResizeMove = (ev: MouseEvent) => {
      const rect = overlay.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight

      let newWidth = startWidth
      let newHeight = startHeight

      if (direction === 'right' || direction === 'corner') {
        newWidth = Math.min(
          Math.max(200, startWidth + (ev.clientX - startX)),
          vw - rect.left - 8,
        )
      }

      if (direction === 'bottom' || direction === 'corner') {
        newHeight = Math.min(
          Math.max(150, startHeight + (ev.clientY - startY)),
          vh - rect.top - 8,
        )
      }

      overlay.style.width = `${newWidth}px`
      overlay.style.height = `${newHeight}px`
    }

    const handleResizeUp = () => {
      document.removeEventListener('mousemove', handleResizeMove)
      document.removeEventListener('mouseup', handleResizeUp)
    }

    document.addEventListener('mousemove', handleResizeMove)
    document.addEventListener('mouseup', handleResizeUp)
  }

  return { overlayRef, handleMouseDown, startResize }
}
