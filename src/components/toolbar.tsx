import { useDocumentStore } from '@/lib/stores/document-store'
import { Slider } from './ui/slider'
import { Switch } from './ui/switch'
import { Button } from './ui/button'
import { RedoIcon, UndoIcon } from 'lucide-react'
import { useHistoryStore } from '@/lib/stores/history-store'

export default function Toolbar() {
  const {
    fontSize,
    columns,
    gapX,
    gapY,
    marginX,
    marginY,
    debug,
    setFontSize,
    setColumns,
    setGapX,
    setGapY,
    setMarginX,
    setMarginY,
    toggleDebug,
  } = useDocumentStore()

  const { past, future } = useHistoryStore()

  return (
    <div className="p-2 flex gap-4">
      <div>
        Font size:
        <Slider
          defaultValue={[fontSize]}
          onValueChange={([value]) => setFontSize(value)}
          max={50}
          step={1}
        />
      </div>
      <div>
        Columns:
        <Slider
          defaultValue={[columns]}
          onValueChange={([value]) => setColumns(value)}
          max={24}
          min={1}
          step={1}
        />
      </div>
      <div>
        Gap X:
        <Slider
          defaultValue={[gapX]}
          onValueChange={([value]) => setGapX(value)}
          max={10}
          step={0.1}
        />
      </div>
      <div>
        Gap Y:
        <Slider
          defaultValue={[gapY]}
          onValueChange={([value]) => setGapY(value)}
          max={10}
          step={0.1}
        />
      </div>

      <div>
        Margin X:
        <Slider
          defaultValue={[marginX]}
          onValueChange={([value]) => setMarginX(value)}
          max={100}
          step={5}
        />
      </div>
      <div>
        Margin Y:
        <Slider
          defaultValue={[marginY]}
          onValueChange={([value]) => setMarginY(value)}
          max={100}
          step={5}
        />
      </div>

      <div>
        Undo:
        <Button
          onClick={() => useHistoryStore.getState().undo()}
          className="block h-8"
          variant="outline"
          disabled={past.length === 0}
        >
          <UndoIcon />
        </Button>
      </div>
      <div>
        Redo:
        <Button
          onClick={() => useHistoryStore.getState().redo()}
          className="block h-8"
          variant="outline"
          disabled={future.length === 0}
        >
          <RedoIcon />
        </Button>
      </div>

      <div className="ml-auto">
        Debug:
        <Switch
          className="block"
          checked={debug}
          onCheckedChange={toggleDebug}
        />
      </div>
    </div>
  )
}
