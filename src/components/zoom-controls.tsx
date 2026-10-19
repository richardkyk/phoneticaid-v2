import { useEffect, useRef } from 'react'
import { MinusIcon, MoveHorizontalIcon, PlusIcon } from 'lucide-react'
import { useDocumentStore } from '@/lib/stores/document-store'
import { useUiStore } from '@/lib/stores/ui-store'
import { Button } from './ui/button'

interface ZoomControlsProps {
  scrollRef: React.RefObject<HTMLDivElement | null>
  // px around the pages, which doesn't scale with the zoom
  padding: number
}
export function ZoomControls({ scrollRef, padding }: ZoomControlsProps) {
  const zoom = useUiStore((state) => state.zoom)
  // scroll position a zoom is about to apply, so quick successive zooms (e.g.
  // pinching) build on it instead of the not yet updated scroll position
  const pendingScrollRef = useRef<{ left: number; top: number } | null>(null)

  // Changes the zoom keeping the point under `anchor` (client coords, the
  // centre of the canvas by default) in the same place on screen
  const zoomTo = (getZoom: () => void, anchor?: { x: number; y: number }) => {
    const scrollEl = scrollRef.current
    const before = useUiStore.getState().zoom
    getZoom()
    const after = useUiStore.getState().zoom
    if (!scrollEl || before === after) return

    const rect = scrollEl.getBoundingClientRect()
    const x = (anchor?.x ?? rect.left + rect.width / 2) - rect.left
    const y = (anchor?.y ?? rect.top + rect.height / 2) - rect.top
    const scroll = pendingScrollRef.current ?? {
      left: scrollEl.scrollLeft,
      top: scrollEl.scrollTop,
    }
    const scale = after / before
    const target = {
      left: (scroll.left + x - padding) * scale + padding - x,
      top: (scroll.top + y - padding) * scale + padding - y,
    }

    // wait for the pages to re-render at the new size
    if (!pendingScrollRef.current) {
      requestAnimationFrame(() => {
        const pending = pendingScrollRef.current
        pendingScrollRef.current = null
        if (!pending) return
        scrollEl.scrollLeft = pending.left
        scrollEl.scrollTop = pending.top
      })
    }
    pendingScrollRef.current = target
  }

  const fitWidth = () => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return
    const document = useDocumentStore.getState()
    zoomTo(() =>
      useUiStore
        .getState()
        .setZoom(
          (scrollEl.clientWidth - padding * 2) /
            (document.pageWidth() * document.mmX),
        ),
    )
  }

  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return
    const ui = () => useUiStore.getState()

    // ctrl + scroll, which is also what trackpad pinches send
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      zoomTo(() => ui().setZoom(ui().zoom * Math.exp(-e.deltaY * 0.01)), {
        x: e.clientX,
        y: e.clientY,
      })
    }

    // cmd/ctrl +, - and 0, instead of zooming the whole browser page
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      if (e.key === '=' || e.key === '+') zoomTo(ui().zoomIn)
      else if (e.key === '-') zoomTo(ui().zoomOut)
      else if (e.key === '0') zoomTo(() => ui().setZoom(1))
      else return
      e.preventDefault()
    }

    scrollEl.addEventListener('wheel', handleWheel, { passive: false })
    // capture so this runs before the editor sees the key
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      scrollEl.removeEventListener('wheel', handleWheel)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [])

  return (
    <div className="absolute bottom-4 right-4 flex items-center rounded-lg border bg-background shadow-sm print:hidden">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => zoomTo(useUiStore.getState().zoomOut)}
        title="Zoom out"
      >
        <MinusIcon />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="w-14 px-0 tabular-nums"
        onClick={() => zoomTo(() => useUiStore.getState().setZoom(1))}
        title="Reset to 100%"
      >
        {Math.round(zoom * 100)}%
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => zoomTo(useUiStore.getState().zoomIn)}
        title="Zoom in"
      >
        <PlusIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={fitWidth}
        title="Fit width"
      >
        <MoveHorizontalIcon />
      </Button>
    </div>
  )
}
