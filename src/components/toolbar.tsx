import { DocumentState, useDocumentStore } from '@/lib/stores/document-store'
import { Switch } from './ui/switch'
import { Button } from './ui/button'
import {
  BugIcon,
  ChevronDown,
  LanguagesIcon,
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
import { usePieceTableStore } from '@/lib/stores/piece-table-store'
import { buildRows } from '@/lib/render'
import { Page } from './page'
import { createRoot } from 'react-dom/client'
import { RadioGroup, RadioGroupItem } from './ui/radio-group'
import { Label } from './ui/label'
import { HoldButton } from './hold-button'
import { toast } from 'sonner'

export default function Toolbar() {
  return (
    <ClientOnly>
      <div className="p-2 container mx-auto flex h-full font-sans items-center print:hidden">
        <EditPopover />
        <PrintButton />
        <Separator
          orientation="vertical"
          className="data-[orientation=vertical]:h-[30px] mx-1"
        />
        <LayoutPopover />
        <MarginPopover />
        <GapPopover />
        <TextPopover />
        <TranslateButton />
        <DebugButton className="ml-auto" />
      </div>
    </ClientOnly>
  )
}

type NumberKeys<T> = {
  [K in keyof T]: T[K] extends number ? K : never
}[keyof T]
interface NumberControlProps {
  label: string
  value: number
  valueKey: NumberKeys<DocumentState>
  setValue: (value: number) => void
  min: number
  max: number
  step: number
  decimalPoints?: number
}
function NumberControl({
  label,
  value,
  valueKey,
  setValue,
  min,
  max,
  step,
  decimalPoints = 0,
}: NumberControlProps) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n))

  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs text-gray-600">{label}</Label>
      <ButtonGroup>
        <HoldButton
          className="shadow-none"
          variant="outline"
          size="icon-sm"
          onClick={() => {
            const v = useDocumentStore.getState()[valueKey]
            setValue(clamp(v - step))
          }}
          disabled={value <= min}
        >
          <MinusIcon />
        </HoldButton>

        <input
          type="number"
          value={value.toFixed(decimalPoints)}
          onChange={(e) => setValue(clamp(Number(e.target.value)))}
          className="border text-center w-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />

        <HoldButton
          className="shadow-none"
          variant="outline"
          size="icon-sm"
          onClick={() => {
            const v = useDocumentStore.getState()[valueKey]
            setValue(clamp(v + step))
          }}
          disabled={value >= max}
        >
          <PlusIcon />
        </HoldButton>
      </ButtonGroup>
    </div>
  )
}

function PrintButton() {
  const handlePrint = () => {
    const id = toast.loading('Generating...')
    // Create a hidden iframe
    const iframe = document.createElement('iframe')
    iframe.id = 'iframedownload'
    iframe.style.position = 'fixed'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = 'none'
    iframe.style.visibility = 'hidden'
    document.body.appendChild(iframe)

    const cleanup = () => {
      toast.dismiss(id)
      const el = document.getElementById('iframedownload')
      if (!el) return
      document.body.removeChild(el)
    }

    // Function to wait for all stylesheets to load
    const waitForStylesheets = async (doc: Document) => {
      const stylePromises: Promise<void>[] = []

      // Iterate over existing link and style elements in the main document
      // QuerySelectorAll returns a NodeListOf<Element> which is fine
      document
        .querySelectorAll('link[rel="stylesheet"], style')
        .forEach((el) => {
          // Ensure we are working with an actual Element type
          if (!(el instanceof Element)) return

          const clonedEl = el.cloneNode(true) as Element
          doc.head.appendChild(clonedEl)

          // Check if it's a LINK tag and has a rel="stylesheet"
          // tagName check implicitly works here because we know it's an Element
          if (
            clonedEl.tagName === 'LINK' &&
            (el as HTMLLinkElement).rel === 'stylesheet'
          ) {
            // We can be sure it's a HTMLLinkElement now, so we assert
            const linkElement = clonedEl as HTMLLinkElement

            stylePromises.push(
              new Promise((resolve, reject) => {
                linkElement.onload = () => resolve()
                linkElement.onerror = (err) => reject(err)
              }),
            )
          }
        })
      return Promise.all(stylePromises).then(() => {}) // Return a Promise<void>
    }

    const handlePrint = async function () {
      // Use async function here
      const doc = iframe.contentDocument
      if (!doc) return

      // Now populate the document's structure using innerHTML on the root element
      doc.documentElement.innerHTML = `
       <head>
        <title>Print Document</title>
        <style>
            body { margin: 0; }
            .page {
                page-break-after: always;
                box-sizing: border-box;
            }
        </style>
       </head>
       <body></body>
       `

      // Wait for all the cloned stylesheets to load
      try {
        await waitForStylesheets(doc)

        // Stylesheets are loaded, now render React components
        const documentStore = useDocumentStore.getState()
        const pt = usePieceTableStore.getState().pt
        const data = buildRows(pt, documentStore)
        const rowsPerPage = documentStore.rowsPerPage()
        const pages = []

        for (let i = 0; i < data.rows.length; i += rowsPerPage) {
          pages.push(data.rows.slice(i, i + rowsPerPage))
        }

        // Render React components into iframe body
        const root = createRoot(doc.body)
        root.render(
          <>
            {pages.map((p, i) => (
              <Page
                key={i}
                document={documentStore}
                pageIndex={i}
                pageRows={p}
                pieceMap={data.pieceMap}
              />
            ))}
          </>,
        )

        // Wait for React to finish rendering (this part is still a slight hack, but better than before)
        // A small timeout might still be needed if React rendering takes time.
        setTimeout(() => {
          toast.dismiss(id)
          iframe.contentWindow?.focus()
          iframe.contentWindow?.print()
          cleanup()
        }, 100)
      } catch (error) {
        console.error('Error loading stylesheets for printing:', error)
        cleanup()
        toast.error('Something went wrong')
      }
    }

    const timer = setInterval(async function () {
      const _iframe = document.getElementById(
        'iframedownload',
      ) as HTMLIFrameElement
      if (!_iframe) return
      const iframeDoc =
        _iframe.contentDocument || _iframe.contentWindow?.document
      // Check if loading is complete
      if (
        iframeDoc?.readyState == 'complete' ||
        iframeDoc?.readyState == 'interactive'
      ) {
        await handlePrint()

        clearInterval(timer)
        toast.dismiss(id)
        return
      }
    }, 1000)

    setTimeout(() => {
      // Cleanup after 10 seconds
      clearInterval(timer)
      cleanup()
    }, 10000)
  }

  return (
    <Button variant="ghost" onClick={() => handlePrint()} size="icon">
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
      className={cn(
        props.className,
        'shadow-none',
        !debug && 'border-transparent',
      )}
      onClick={() => toggleDebug()}
      variant="outline"
      size="icon-sm"
    >
      <BugIcon className="size-4" />
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
            valueKey="fontSize"
            setValue={setFontSize}
            min={1}
            max={100}
            step={1}
          />
          <Separator />
          <NumberControl
            label="Pinyin Size"
            value={pinyinSize}
            valueKey="pinyinSize"
            setValue={setPinyinSize}
            min={0}
            max={20}
            step={0.1}
            decimalPoints={1}
          />
          <NumberControl
            label="Pinyin Offset"
            value={pinyinOffset}
            valueKey="pinyinOffset"
            setValue={setPinyinOffset}
            min={0}
            max={20}
            step={0.1}
            decimalPoints={1}
          />

          <div className="flex items-center justify-between h-8">
            <Label className="text-xs text-gray-600">
              Pinyin Position (Above)
            </Label>
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
  const { columns, layout, setColumns, setLayout } = useDocumentStore()
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
            valueKey="columns"
            setValue={setColumns}
            min={1}
            max={30}
            step={1}
          />
          <Separator />
          <div className="flex items-start justify-between">
            <Label className="text-xs text-gray-600">Layout</Label>
            <RadioGroup defaultValue={layout} onValueChange={setLayout}>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="portrait" id="r1" />
                <Label htmlFor="r1">Portrait</Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="landscape" id="r2" />
                <Label htmlFor="r2">Landscape</Label>
              </div>
            </RadioGroup>
          </div>
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
            valueKey="gapX"
            setValue={setGapX}
            min={0}
            max={30}
            step={0.1}
            decimalPoints={1}
          />
          <NumberControl
            label="Gap Y"
            value={gapY}
            valueKey="gapY"
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
            valueKey="marginX"
            setValue={setMarginX}
            min={0}
            max={100}
            step={5}
          />
          <NumberControl
            label="Margin Y"
            value={marginY}
            valueKey="marginY"
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

interface TranslateProps {
  className?: string
}
function TranslateButton(props: TranslateProps) {
  const { translate, toggleTranslate } = useDocumentStore()
  return (
    <Button
      className={cn(
        props.className,
        'shadow-none',
        !translate && 'border-transparent',
      )}
      onClick={() => toggleTranslate()}
      size="icon-sm"
      variant="outline"
    >
      <LanguagesIcon className="size-4" />
    </Button>
  )
}
