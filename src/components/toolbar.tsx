import { useDocumentStore } from '@/lib/document-store'
import { Slider } from './ui/slider'

export default function Toolbar() {
  const {
    fontSize,
    columns,
    gapX,
    gapY,
    marginX,
    marginY,
    setFontSize,
    setColumns,
    setGapX,
    setGapY,
    setMarginX,
    setMarginY,
  } = useDocumentStore()

  return (
    <div className="border-b p-2 flex gap-4">
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
    </div>
  )
}
