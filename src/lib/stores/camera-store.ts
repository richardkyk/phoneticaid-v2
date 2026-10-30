import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// The canvas is a camera over a "world" where the pages are laid out once at
// 100%. Panning and zooming only move the camera, so the pages never re-render

const ZOOM_LEVELS = [
  0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4,
]
export const MIN_ZOOM = ZOOM_LEVELS[0]
export const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1]

// px between pages in the world
export const PAGE_GAP = 24
// the pages are stacked from the top of the world
export const pageTop = (pageIndex: number, pageHeight: number) =>
  pageIndex * (pageHeight + PAGE_GAP)
// px around the pages when fitting them to the viewport
const FIT_PADDING = 24

export interface Point {
  x: number
  y: number
}
interface Size {
  width: number
  height: number
}
export interface Rect extends Point, Size {}

const clamp = (val: number, min: number, max: number) =>
  Math.min(Math.max(val, min), max)

interface CameraState {
  // a world point is drawn at world * zoom + (x, y), in px relative to the viewport
  x: number
  y: number
  zoom: number
  viewport: Size
  // size of the pages in the world
  content: Size
  // whether the camera has been placed over the pages yet
  ready: boolean
  setViewport: (size: Size) => void
  setContent: (size: Size) => void
  panBy: (dx: number, dy: number) => void
  // zooms keeping the point under `anchor` (viewport px, the centre by
  // default) in the same place on screen
  zoomAt: (zoom: number, anchor?: Point) => void
  zoomIn: () => void
  zoomOut: () => void
  fitWidth: () => void
  // pans the least needed to bring a world rect into view
  reveal: (rect: Rect, margin?: number) => void
}

export const useCameraStore = create<CameraState>()(
  persist(
    (set, get) => {
      // keeps part of the pages under the middle of the viewport, so there's
      // room to pan around them but they can't be lost off screen. Pages
      // smaller than the viewport can also sit anywhere fully in view (e.g.
      // at the top, zoomed out), rather than being pushed to the middle
      const bound = (pos: number, view: number, size: number) =>
        clamp(
          pos,
          Math.min(view / 2 - size, 0),
          Math.max(view / 2, view - size),
        )
      const place = (x: number, y: number, zoom: number) => {
        const { viewport: v, content: c } = get()
        set({
          zoom,
          x: bound(x, v.width, c.width * zoom),
          y: bound(y, v.height, c.height * zoom),
        })
      }

      // centres the pages horizontally with the first page at the top
      const placeInitially = () => {
        const { viewport: v, content: c, zoom, ready } = get()
        if (ready || !v.width || !c.width) return
        set({ ready: true })
        place((v.width - c.width * zoom) / 2, FIT_PADDING, zoom)
      }

      const centre = (): Point => ({
        x: get().viewport.width / 2,
        y: get().viewport.height / 2,
      })

      return {
        x: 0,
        y: 0,
        zoom: 1,
        viewport: { width: 0, height: 0 },
        content: { width: 0, height: 0 },
        ready: false,
        setViewport: (viewport) => {
          set({ viewport })
          placeInitially()
          const { x, y, zoom } = get()
          place(x, y, zoom)
        },
        setContent: (content) => {
          set({ content })
          placeInitially()
          const { x, y, zoom } = get()
          place(x, y, zoom)
        },
        panBy: (dx, dy) => {
          const { x, y, zoom } = get()
          place(x + dx, y + dy, zoom)
        },
        zoomAt: (next, anchor = centre()) => {
          const { x, y, zoom } = get()
          next = clamp(next, MIN_ZOOM, MAX_ZOOM)
          const scale = next / zoom
          place(
            anchor.x - (anchor.x - x) * scale,
            anchor.y - (anchor.y - y) * scale,
            next,
          )
        },
        // step to the next preset zoom level
        zoomIn: () => {
          const next = ZOOM_LEVELS.find((z) => z > get().zoom + 0.001)
          get().zoomAt(next ?? MAX_ZOOM)
        },
        zoomOut: () => {
          const prev = [...ZOOM_LEVELS]
            .reverse()
            .find((z) => z < get().zoom - 0.001)
          get().zoomAt(prev ?? MIN_ZOOM)
        },
        fitWidth: () => {
          const { viewport: v, content: c, y, zoom } = get()
          if (!c.width) return
          const next = clamp(
            (v.width - FIT_PADDING * 2) / c.width,
            MIN_ZOOM,
            MAX_ZOOM,
          )
          // keep the middle of the viewport on the same part of the pages
          const centreY = v.height / 2
          place(
            (v.width - c.width * next) / 2,
            centreY - ((centreY - y) / zoom) * next,
            next,
          )
        },
        reveal: (rect, margin = 100) => {
          const { x, y, zoom, viewport: v } = get()
          const marginX = Math.min(margin, v.width / 4)
          const marginY = Math.min(margin, v.height / 4)
          const left = rect.x * zoom + x
          const top = rect.y * zoom + y
          const right = left + rect.width * zoom
          const bottom = top + rect.height * zoom
          let dx = 0
          let dy = 0
          if (left < marginX) dx = marginX - left
          else if (right > v.width - marginX) dx = v.width - marginX - right
          if (top < marginY) dy = marginY - top
          else if (bottom > v.height - marginY) dy = v.height - marginY - bottom
          if (dx || dy) get().panBy(dx, dy)
        },
      }
    },
    {
      name: 'camera',
      partialize: (state) => ({ zoom: state.zoom }),
    },
  ),
)
