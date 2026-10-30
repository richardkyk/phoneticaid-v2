import { useRef } from 'react'
import { useCameraStore } from '@/lib/stores/camera-store'
import { useCursorStore } from '@/lib/stores/cursor-store'
import { useDocumentStore } from '@/lib/stores/document-store'
import { useProjectsStore } from '@/lib/stores/projects-store'
import { useTranslateStore } from '@/lib/stores/translate-store'
import { getLayout } from '@/lib/layout'
import type { Position } from '@/lib/layout'
import { isVertical } from '@/lib/geometry'
import { caretViewportRect } from '@/lib/popover'

// size of the knob, and of the area around it a finger can grab
const KNOB = 12
const HIT = 44

interface SelectionHandlesProps {
  // the caret position (absolute offset) for a point in client px
  indexAtPoint: (x: number, y: number) => number | null
}
// Handles at either end of a finger's selection, dragged to move that end.
// The selection is translated again once a handle is let go.
export function SelectionHandles(props: SelectionHandlesProps) {
  const document = useDocumentStore()
  const camera = useCameraStore()
  const pt = useProjectsStore((state) => state.getActiveProject().pt)
  const touchSelection = useCursorStore((state) => state.touchSelection)
  useCursorStore((state) => state.selectionStart)
  useCursorStore((state) => state.selectionEnd)
  const selection = useCursorStore.getState().getSelection()
  if (!touchSelection || !selection) return null

  const layout = getLayout(pt, document.columns)
  const vertical = isVertical(document.writingMode)
  return (
    <>
      {(['start', 'end'] as const).map((side) => {
        const pos = selection[side]
        const rect = caretViewportRect(document, layout, camera, pos)
        return (
          <Handle
            key={side}
            side={side}
            rect={rect}
            vertical={vertical}
            other={side === 'start' ? selection.end : selection.start}
            indexAtPoint={props.indexAtPoint}
          />
        )
      })}
    </>
  )
}

interface HandleProps {
  side: 'start' | 'end'
  rect: { left: number; top: number; width: number; height: number }
  vertical: boolean
  // the other end of the selection, which stays put while this one is dragged
  other: Position
  indexAtPoint: (x: number, y: number) => number | null
}
function Handle(props: HandleProps) {
  const { side, rect, vertical } = props
  const drag = useRef<{
    pointerId: number
    fixed: number
    dx: number
    dy: number
  } | null>(null)

  // the bar runs along the caret, with the knob off its start (top or left)
  // or end (bottom or right)
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const knob = vertical
    ? {
        x:
          side === 'start'
            ? rect.left - KNOB / 2
            : rect.left + rect.width + KNOB / 2,
        y: centerY,
      }
    : {
        x: centerX,
        y:
          side === 'start'
            ? rect.top - KNOB / 2
            : rect.top + rect.height + KNOB / 2,
      }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    // dragged from where it was grabbed, so the finger doesn't cover the
    // caret it's moving
    drag.current = {
      pointerId: e.pointerId,
      fixed: props.other.index,
      dx: centerX - e.clientX,
      dy: centerY - e.clientY,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || e.pointerId !== d.pointerId) return
    const index = props.indexAtPoint(e.clientX + d.dx, e.clientY + d.dy)
    // the selection keeps at least a character
    if (index === null || index === d.fixed) return
    useCursorStore
      .getState()
      .selectRange(Math.min(index, d.fixed), Math.max(index, d.fixed), false)
  }
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== drag.current?.pointerId) return
    drag.current = null
    useTranslateStore.getState().translateSelection()
  }

  return (
    <>
      <div
        className="pointer-events-none absolute z-10 bg-amber-500 print:hidden"
        style={
          vertical
            ? {
                left: rect.left,
                top: centerY - 1,
                width: rect.width,
                height: 2,
              }
            : {
                left: centerX - 1,
                top: rect.top,
                width: 2,
                height: rect.height,
              }
        }
      />
      <div
        className="absolute z-10 flex touch-none items-center justify-center select-none [-webkit-touch-callout:none] print:hidden"
        style={{
          left: knob.x - HIT / 2,
          top: knob.y - HIT / 2,
          width: HIT,
          height: HIT,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="rounded-full bg-amber-500 shadow"
          style={{ width: KNOB, height: KNOB }}
        />
      </div>
    </>
  )
}
