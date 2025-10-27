import { useDocumentStore } from '@/lib/stores/document-store'
import { Switch } from './ui/switch'
import { Button } from './ui/button'
import {
  BugIcon,
  ChevronDown,
  LayoutIcon,
  Maximize2Icon,
  MinusIcon,
  MoveIcon,
  PlusIcon,
  PrinterIcon,
  RedoIcon,
  Type,
  UndoIcon,
} from 'lucide-react'
import { useHistoryStore } from '@/lib/stores/history-store'
import { ClientOnly } from '@tanstack/react-router'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { ButtonGroup } from './ui/button-group'
import { Separator } from './ui/separator'
import { cn } from '@/lib/utils'

export default function Toolbar() {
  return (
    <ClientOnly>
      <div className="p-2 flex h-full font-sans items-center print:hidden">
        <EditPopover />
        <PrintButton />
        <Separator
          orientation="vertical"
          className="data-[orientation=vertical]:h-[30px]"
        />
        <LayoutPopover />
        <MarginPopover />
        <GapPopover />
        <TextPopover />
        <DebugButton className="ml-auto" />
      </div>
    </ClientOnly>
  )
}

interface NumberControlProps {
  label: string
  value: number
  setValue: (value: number) => void
  min: number
  max: number
  step: number
  decimalPoints?: number
}
function NumberControl({
  label,
  value,
  setValue,
  min,
  max,
  step,
  decimalPoints = 0,
}: NumberControlProps) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n))

  return (
    <div className="flex items-center justify-between">
      <label className="text-xs text-gray-600">{label}</label>
      <ButtonGroup>
        <Button
          className="shadow-none"
          variant="outline"
          size="icon-sm"
          onClick={() => setValue(clamp(value - step))}
          disabled={value <= min}
        >
          <MinusIcon />
        </Button>

        <input
          type="number"
          value={value.toFixed(decimalPoints)}
          onChange={(e) => setValue(clamp(Number(e.target.value)))}
          className="border text-center w-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />

        <Button
          className="shadow-none"
          variant="outline"
          size="icon-sm"
          onClick={() => setValue(clamp(value + step))}
          disabled={value >= max}
        >
          <PlusIcon />
        </Button>
      </ButtonGroup>
    </div>
  )
}

function PrintButton() {
  return (
    <Button variant="ghost" onClick={() => window.print()} size="icon">
      <PrinterIcon className="size-4" />
    </Button>
  )
}

interface DebugProps {
  className?: string
}
function DebugButton(props: DebugProps) {
  const { debug, toggleDebug } = useDocumentStore()
  return (
    <Button
      className={cn(props.className)}
      onClick={() => toggleDebug()}
      variant="ghost"
    >
      <BugIcon
        className={cn('size-4', debug ? 'text-primary' : 'text-gray-400')}
      />
    </Button>
  )
}

function EditPopover() {
  const { past, future } = useHistoryStore()

  return (
    <div className="flex items-center">
      <Button
        onClick={() => useHistoryStore.getState().undo()}
        size="icon-sm"
        variant="ghost"
        disabled={past.length === 0}
      >
        <UndoIcon />
      </Button>
      <Button
        onClick={() => useHistoryStore.getState().redo()}
        size="icon-sm"
        variant="ghost"
        disabled={future.length === 0}
      >
        <RedoIcon />
      </Button>
    </div>
  )
}

function TextPopover() {
  const {
    fontSize,
    pinyinSize,
    pinyinOffset,
    pinyinPosition,
    setFontSize,
    setPinyinSize,
    setPinyinOffset,
    setPinyinPosition,
  } = useDocumentStore()
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <Type className="size-4" />
          <ChevronDown className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="space-y-3 font-sans">
          <NumberControl
            label="Font Size"
            value={fontSize}
            setValue={setFontSize}
            min={1}
            max={100}
            step={1}
          />
          <Separator />
          <NumberControl
            label="Pinyin Size"
            value={pinyinSize}
            setValue={setPinyinSize}
            min={0}
            max={20}
            step={0.1}
            decimalPoints={1}
          />
          <NumberControl
            label="Pinyin Offset"
            value={pinyinOffset}
            setValue={setPinyinOffset}
            min={0}
            max={20}
            step={0.1}
            decimalPoints={1}
          />

          <div className="flex items-center justify-between h-8">
            <label className="text-xs text-gray-600">
              Pinyin Position (Above)
            </label>
            <Switch
              className="block"
              checked={pinyinPosition === 'top'}
              onCheckedChange={() =>
                setPinyinPosition(pinyinPosition === 'top' ? 'bottom' : 'top')
              }
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function LayoutPopover() {
  const { columns, setColumns } = useDocumentStore()
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <LayoutIcon className="size-4" />
          <ChevronDown className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="space-y-3 font-sans">
          <NumberControl
            label="Columns"
            value={columns}
            setValue={setColumns}
            min={1}
            max={30}
            step={1}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

function GapPopover() {
  const { gapX, gapY, setGapX, setGapY } = useDocumentStore()
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <MoveIcon className="size-4" />
          <ChevronDown className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="space-y-3 font-sans">
          <NumberControl
            label="Gap X"
            value={gapX}
            setValue={setGapX}
            min={0}
            max={30}
            step={0.1}
            decimalPoints={1}
          />
          <NumberControl
            label="Gap Y"
            value={gapY}
            setValue={setGapY}
            min={0}
            max={30}
            step={0.1}
            decimalPoints={1}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

function MarginPopover() {
  const { marginX, marginY, setMarginX, setMarginY } = useDocumentStore()
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <Maximize2Icon className="size-4" />
          <ChevronDown className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="space-y-3 font-sans">
          <NumberControl
            label="Margin X"
            value={marginX}
            setValue={setMarginX}
            min={0}
            max={100}
            step={5}
          />
          <NumberControl
            label="Margin Y"
            value={marginY}
            setValue={setMarginY}
            min={0}
            max={100}
            step={5}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
