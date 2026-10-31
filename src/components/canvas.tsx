import { useLayoutEffect } from 'react'
import { useCameraStore } from '@/lib/stores/camera-store'

// ms the camera has to be still before the pages are redrawn sharp at the new zoom
const SETTLE_DELAY = 150
// px between the background dots at 100%
const DOT_SPACING = 16
// how much the zoom changes per px of wheel delta
const ZOOM_SPEED = 0.01
// most px of wheel delta zoomed per frame, so big wheel deltas (e.g. ctrl +
// trackpad scroll, which sends hundreds of px per event) don't zoom in jumps
// while pinches (a few px per frame) aren't held back
const MAX_ZOOM_DELTA_PER_FRAME = 8
// px from the screen's sides where iOS swipes go back or forward a page
const EDGE_SWIPE = 24
// ms without wheel events that ends a scroll gesture (including the trackpad's
// momentum after the fingers lift)
const WHEEL_GESTURE_GAP = 150

const clamp = (val: number, min: number, max: number) =>
  Math.min(Math.max(val, min), max)

// Safari sends pinches as gesture events rather than ctrl + wheel
type GestureEvent = UIEvent & {
  scale: number
  clientX: number
  clientY: number
}

// Draws the world (the pages, laid out at 100%) through the camera, and pans
// and zooms the camera from the wheel, trackpad, drags and zoom shortcuts
export function useCanvas(
  viewportRef: React.RefObject<HTMLDivElement | null>,
  worldRef: React.RefObject<HTMLDivElement | null>,
) {
  useLayoutEffect(() => {
    const viewportEl = viewportRef.current
    const worldEl = worldRef.current
    if (!viewportEl || !worldEl) return
    const camera = useCameraStore.getState

    // viewport px for a pointer event
    const toViewport = (e: { clientX: number; clientY: number }) => {
      const rect = viewportEl.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    // While the camera moves the pages are moved as one image, which is cheap
    // but blurry once zoomed. When it settles after a zoom they're dropped
    // back into the page so the browser redraws them sharp
    let settleTimer: number | undefined
    let sharpZoom = camera().zoom
    const draw = () => {
      const { x, y, zoom, ready } = camera()
      worldEl.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`
      worldEl.style.visibility = ready ? '' : 'hidden'

      // the dots move with the pages, doubling or halving their spacing to
      // stay roughly the same density
      let spacing = DOT_SPACING * zoom
      while (spacing < DOT_SPACING * 0.75) spacing *= 2
      while (spacing > DOT_SPACING * 1.5) spacing /= 2
      viewportEl.style.backgroundSize = `${spacing}px ${spacing}px`
      viewportEl.style.backgroundPosition = `${x}px ${y}px`

      if (zoom === sharpZoom && worldEl.style.willChange) return
      worldEl.style.willChange = 'transform'
      window.clearTimeout(settleTimer)
      settleTimer = window.setTimeout(() => {
        if (camera().zoom === sharpZoom) return
        sharpZoom = camera().zoom
        worldEl.style.willChange = ''
      }, SETTLE_DELAY)
    }
    draw()
    const unsubscribe = useCameraStore.subscribe(draw)

    const resizeObserver = new ResizeObserver(() =>
      camera().setViewport({
        width: viewportEl.clientWidth,
        height: viewportEl.clientHeight,
      }),
    )
    resizeObserver.observe(viewportEl)

    // wheel zooms are added up and applied once a frame, as browsers can send
    // several wheel events a frame
    let wheelZoom: { delta: number; anchor: { x: number; y: number } } | null =
      null
    let wheelZoomFrame: number | undefined
    const applyWheelZoom = () => {
      wheelZoomFrame = undefined
      if (!wheelZoom) return
      const delta = clamp(
        wheelZoom.delta,
        -MAX_ZOOM_DELTA_PER_FRAME,
        MAX_ZOOM_DELTA_PER_FRAME,
      )
      camera().zoomAt(
        camera().zoom * Math.exp(-delta * ZOOM_SPEED),
        wheelZoom.anchor,
      )
      wheelZoom = null
    }

    // Trackpad pinches arrive as wheel events with ctrlKey set, the same as
    // ctrl + scroll, so the real Control key is tracked to tell them apart.
    // ctrl + scroll zooms far too fast in some browsers, so it's ignored
    let controlHeld = false
    const handleControl = (e: KeyboardEvent) => {
      if (e.key === 'Control') controlHeld = e.type === 'keydown'
    }
    const releaseControl = () => (controlHeld = false)

    // What a scroll gesture does is decided when it starts and kept until it
    // ends, so its momentum doesn't start panning once the key is let go
    let wheelMode: 'pan' | 'zoom' | 'ignore' | null = null
    let wheelGestureTimer: number | undefined
    const wheelModeFor = (e: WheelEvent) =>
      controlHeld ? 'ignore' : e.ctrlKey || e.metaKey ? 'zoom' : 'pan'

    // scrolling (two fingers on a trackpad) pans, pinching and cmd + scroll zoom
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      window.clearTimeout(wheelGestureTimer)
      wheelGestureTimer = window.setTimeout(
        () => (wheelMode = null),
        WHEEL_GESTURE_GAP,
      )
      // pressing a key mid pan switches to zooming (or ignoring) straight away
      if (!wheelMode || (wheelMode === 'pan' && wheelModeFor(e) !== 'pan')) {
        wheelMode = wheelModeFor(e)
      }
      if (wheelMode === 'ignore') return
      const unit =
        e.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? viewportEl.clientHeight
            : 1
      let dx = e.deltaX * unit
      let dy = e.deltaY * unit
      if (wheelMode === 'zoom') {
        wheelZoom = {
          delta: (wheelZoom?.delta ?? 0) + dy,
          anchor: toViewport(e),
        }
        wheelZoomFrame ??= requestAnimationFrame(applyWheelZoom)
        return
      }
      // shift + wheel scrolls sideways on mice that only scroll vertically
      if (e.shiftKey && !dx) [dx, dy] = [dy, 0]
      camera().panBy(-dx, -dy)
    }

    let gestureStartZoom = 1
    const handleGestureStart = (e: Event) => {
      e.preventDefault()
      gestureStartZoom = camera().zoom
    }
    const handleGestureChange = (e: Event) => {
      e.preventDefault()
      const gesture = e as GestureEvent
      camera().zoomAt(gestureStartZoom * gesture.scale, toViewport(gesture))
    }

    // dragging the background, a finger anywhere, or middle dragging
    // anywhere, pans (left dragging on the pages with a mouse or pen selects
    // text instead, as does a finger after a long press, see editor.tsx)
    let pan: { pointerId: number; x: number; y: number } | null = null
    const handlePointerDown = (e: PointerEvent) => {
      const onPage = (e.target as HTMLElement).closest('[data-page]')
      const touch = e.pointerType === 'touch'
      if (pan || !(e.button === 1 || (e.button === 0 && (!onPage || touch)))) {
        return
      }
      // no middle click autoscroll
      if (e.button === 1) e.preventDefault()
      pan = { pointerId: e.pointerId, x: e.clientX, y: e.clientY }
      viewportEl.setPointerCapture(e.pointerId)
      viewportEl.dataset.panning = ''
    }
    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerId !== pan?.pointerId) return
      if (!('selecting' in viewportEl.dataset)) {
        camera().panBy(e.clientX - pan.x, e.clientY - pan.y)
      }
      pan.x = e.clientX
      pan.y = e.clientY
    }
    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerId !== pan?.pointerId) return
      pan = null
      delete viewportEl.dataset.panning
    }
    // a finger panning from near the side of the screen would otherwise be
    // taken by iOS as a swipe back or forward a page (it also stops that
    // touch's click, so a tap there doesn't open the keyboard)
    const handleTouchStart = (e: TouchEvent) => {
      const x = e.touches[0]?.clientX
      if (x < EDGE_SWIPE || x > window.innerWidth - EDGE_SWIPE) {
        e.preventDefault()
      }
    }
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault()
    }

    // cmd/ctrl +, - and 0, instead of zooming the whole browser page
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      if (e.key === '=' || e.key === '+') camera().zoomIn()
      else if (e.key === '-') camera().zoomOut()
      else if (e.key === '0') camera().zoomAt(1)
      else return
      e.preventDefault()
    }

    viewportEl.addEventListener('wheel', handleWheel, { passive: false })
    viewportEl.addEventListener('gesturestart', handleGestureStart)
    viewportEl.addEventListener('gesturechange', handleGestureChange)
    viewportEl.addEventListener('pointerdown', handlePointerDown)
    viewportEl.addEventListener('pointermove', handlePointerMove)
    viewportEl.addEventListener('pointerup', handlePointerUp)
    viewportEl.addEventListener('pointercancel', handlePointerUp)
    viewportEl.addEventListener('mousedown', handleMouseDown)
    viewportEl.addEventListener('touchstart', handleTouchStart, {
      passive: false,
    })
    // capture so this runs before the editor sees the key
    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keydown', handleControl, true)
    window.addEventListener('keyup', handleControl, true)
    window.addEventListener('blur', releaseControl)
    return () => {
      unsubscribe()
      resizeObserver.disconnect()
      window.clearTimeout(settleTimer)
      window.clearTimeout(wheelGestureTimer)
      if (wheelZoomFrame !== undefined) cancelAnimationFrame(wheelZoomFrame)
      viewportEl.removeEventListener('wheel', handleWheel)
      viewportEl.removeEventListener('gesturestart', handleGestureStart)
      viewportEl.removeEventListener('gesturechange', handleGestureChange)
      viewportEl.removeEventListener('pointerdown', handlePointerDown)
      viewportEl.removeEventListener('pointermove', handlePointerMove)
      viewportEl.removeEventListener('pointerup', handlePointerUp)
      viewportEl.removeEventListener('pointercancel', handlePointerUp)
      viewportEl.removeEventListener('mousedown', handleMouseDown)
      viewportEl.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keydown', handleControl, true)
      window.removeEventListener('keyup', handleControl, true)
      window.removeEventListener('blur', releaseControl)
    }
  }, [])
}
