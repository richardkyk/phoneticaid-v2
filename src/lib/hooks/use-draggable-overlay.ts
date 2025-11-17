import { useSidebar } from '@/components/ui/sidebar'
import { useEffect, useRef } from 'react'

export function useDraggableOverlay() {
  const overlayRef = useRef<HTMLDivElement>(null)
  const sidebarWidth = useRef(0)

  const { open } = useSidebar()

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

      if (open) {
        const sidebarEl = document.querySelector<HTMLElement>(
          '[data-slot="sidebar"]',
        )
        if (sidebarEl && sidebarWidth.current === 0) {
          sidebarWidth.current = sidebarEl.getBoundingClientRect().width
        }
      }
      const sidebarOffset = open ? sidebarWidth.current : 0

      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      // calculate new left/top
      let newLeft = moveEvent.clientX - offset.x - sidebarOffset
      let newTop = moveEvent.clientY - offset.y

      // clamp left/top so overlay stays in viewport
      newLeft = Math.max(
        0,
        Math.min(
          newLeft,
          viewportWidth - rect.width - sidebarOffset - (open ? 8 : 16),
        ),
      )
      newTop = Math.max(0, Math.min(newTop, viewportHeight - rect.height - 16))

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

  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return

    const rect = overlay.getBoundingClientRect()
    const viewportWidth = window.innerWidth

    // parse current left/top or fallback to 0
    let left = parseInt(overlay.style.left) || 0

    if (open) {
      // need to cap the left so it doesn't go off screen
      left = Math.min(
        left,
        viewportWidth - sidebarWidth.current - rect.width - (open ? 8 : 16),
      )
      overlay.style.left = `${left}px`
    }
  }, [open])

  return { overlayRef, handleMouseDown }
}
