import { MinusIcon, MoveHorizontalIcon, PlusIcon } from 'lucide-react'
import { useCameraStore } from '@/lib/stores/camera-store'
import { Button } from './ui/button'

export function ZoomControls() {
  const zoom = useCameraStore((state) => state.zoom)
  const camera = useCameraStore.getState

  return (
    <div className="absolute bottom-4 right-4 flex items-center rounded-lg border bg-background shadow-sm print:hidden">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => camera().zoomOut()}
        title="Zoom out"
      >
        <MinusIcon />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="w-14 px-0 tabular-nums"
        onClick={() => camera().zoomAt(1)}
        title="Reset to 100%"
      >
        {Math.round(zoom * 100)}%
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => camera().zoomIn()}
        title="Zoom in"
      >
        <PlusIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => camera().fitWidth()}
        title="Fit width"
      >
        <MoveHorizontalIcon />
      </Button>
    </div>
  )
}
