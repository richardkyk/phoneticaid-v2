import { useRef } from 'react'

export function useDraggableOverlay() {
  const overlayRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation() // prevent clicks bubbling

    const overlay = overlayRef.current
    if (!overlay) return

    // Get overlay rect and compute cursor offset
    const rect = overlay.getBoundingClientRect()
    const offset = { x: e.clientX - rect.left, y: e.clientY - rect.top }

    // Move overlay with cursor
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!overlay) return

      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      // calculate new left/top
      let newLeft = moveEvent.clientX - offset.x
      let newTop = moveEvent.clientY - offset.y

      // clamp left/top so overlay stays in viewport
      newLeft = Math.max(0, Math.min(newLeft, viewportWidth - rect.width))
      newTop = Math.max(0, Math.min(newTop, viewportHeight - rect.height))

      overlay.style.left = `${newLeft}px`
      overlay.style.top = `${newTop}px`
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      // no snapping, just leave overlay where it is
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return { overlayRef, handleMouseDown }
}
