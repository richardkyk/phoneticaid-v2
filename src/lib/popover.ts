import { pageTop } from './stores/camera-store'
import type { DocumentStore } from './stores/document-store'
import { positionToGrid } from './layout'
import type { Layout, Position } from './layout'
import { caretRect, wordRect } from './geometry'

// space between the text and the popover, and the viewport's edges
const GAP = 8

interface Camera {
  x: number
  y: number
  zoom: number
  viewport: { width: number; height: number }
}

// The caret at `pos` in viewport px
export function caretViewportRect(
  document: DocumentStore,
  layout: Layout,
  camera: Camera,
  pos: Position,
) {
  const { row, col } = positionToGrid(layout, pos)
  const linesPerPage = document.linesPerPage()
  const pageIndex = Math.floor(row / linesPerPage)
  const rect = caretRect(document, row - pageIndex * linesPerPage, col)
  const worldTop =
    pageTop(pageIndex, document.pageHeight() * document.mmY) +
    rect.y * document.mmY
  return {
    left: rect.x * document.mmX * camera.zoom + camera.x,
    top: worldTop * camera.zoom + camera.y,
    width: rect.width * document.mmX * camera.zoom,
    height: rect.height * document.mmY * camera.zoom,
  }
}

// Where to put a popover of `width` px beside the character at `index`: below
// it, or above it in the lower half of the view, `gap` px away. Null when the
// character has been panned out of view.
export function popoverStyle(
  document: DocumentStore,
  layout: Layout,
  camera: Camera,
  index: number,
  width: number,
  gap = GAP,
): React.CSSProperties | null {
  // the character's cell, and its pinyin, in viewport px
  const { row, col } = positionToGrid(layout, {
    index: index + 1,
    virtual: 0,
    affinity: 'upstream',
  })
  const linesPerPage = document.linesPerPage()
  const pageIndex = Math.floor(row / linesPerPage)
  const rect = wordRect(
    document,
    row - pageIndex * linesPerPage,
    Math.max(col - 1, 0),
    Math.max(col - 1, 0),
  )
  const worldTop =
    pageTop(pageIndex, document.pageHeight() * document.mmY) +
    rect.y * document.mmY
  const left = rect.x * document.mmX * camera.zoom + camera.x
  const top = worldTop * camera.zoom + camera.y
  const bottom = top + rect.height * document.mmY * camera.zoom
  const viewport = camera.viewport

  if (bottom < 0 || top > viewport.height) return null

  const above = bottom > viewport.height / 2
  return {
    width,
    left: Math.min(
      Math.max(left, GAP),
      Math.max(viewport.width - width - GAP, GAP),
    ),
    maxHeight: (above ? top : viewport.height - bottom) - gap - GAP,
    ...(above
      ? { bottom: viewport.height - top + gap }
      : { top: bottom + gap }),
  }
}
