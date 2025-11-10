import { DocumentState, useDocumentStore } from '@/lib/stores/document-store'
import { Button } from './ui/button'
import {
  BugIcon,
  FileIcon,
  LanguagesIcon,
  LayoutIcon,
  MinusIcon,
  MoveIcon,
  PlusIcon,
  PrinterIcon,
  RedoIcon,
  TypeIcon,
  UndoIcon,
} from 'lucide-react'
import { useHistoryStore } from '@/lib/stores/history-store'
import { ButtonGroup } from './ui/button-group'
import { cn } from '@/lib/utils'
import { usePieceTableStore } from '@/lib/stores/piece-table-store'
import { buildRows } from '@/lib/render'
import { Page } from './page'
import { createRoot } from 'react-dom/client'
import { RadioGroup, RadioGroupItem } from './ui/radio-group'
import { Label } from './ui/label'
import { HoldButton } from './hold-button'
import { toast } from 'sonner'
import { CollapsibleToolbar } from './collapsible-toolbar'

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

interface PrintButtonProps {
  className?: string
}
function PrintButton(props: PrintButtonProps) {
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

    const forceFont = (doc: Document, fontFamily: string) => {
      const span = doc.createElement('span')
      span.style.fontFamily = fontFamily
      span.style.position = 'absolute'
      span.style.visibility = 'hidden'
      span.textContent = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
      doc.body.appendChild(span)
      return span
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
        const span = forceFont(doc, 'KaiTi2')
        await doc.fonts.ready
        span.remove()

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
        }, 1000)
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
    <Button
      variant="ghost"
      onClick={() => handlePrint()}
      size="icon"
      className={props.className}
    >
      <PrinterIcon className="size-4" />
    </Button>
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
      variant={translate ? 'default' : 'ghost'}
    >
      <LanguagesIcon className="size-4" />
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
      variant={debug ? 'default' : 'ghost'}
      size="icon-sm"
    >
      <BugIcon className="size-4" />
    </Button>
  )
}

export function DocumentToolbar() {
  const { past, future } = useHistoryStore()

  return (
    <CollapsibleToolbar name="Document" icon={<FileIcon className="size-4" />}>
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
        <PrintButton className="ml-auto" />
        <TranslateButton />
        <DebugButton />
      </div>
    </CollapsibleToolbar>
  )
}

export function TextToolbar() {
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
    <CollapsibleToolbar name="Text" icon={<TypeIcon className="size-4" />}>
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
        <div className="flex items-start mt-5 justify-between">
          <Label className="text-xs text-gray-600">Pinyin Position</Label>
          <RadioGroup
            defaultValue={pinyinPosition}
            onValueChange={setPinyinPosition}
          >
            <div className="flex items-center gap-3">
              <RadioGroupItem value="top" id="r1" />
              <Label htmlFor="r1" className="text-xs">
                Above
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <RadioGroupItem value="bottom" id="r2" />
              <Label htmlFor="r2" className="text-xs">
                Below
              </Label>
            </div>
          </RadioGroup>
        </div>
      </div>
    </CollapsibleToolbar>
  )
}

export function LayoutToolbar() {
  const { columns, layout, setColumns, setLayout } = useDocumentStore()

  return (
    <CollapsibleToolbar name="Layout" icon={<LayoutIcon className="size-4" />}>
      <div className="space-y-3">
        <NumberControl
          label="Columns"
          value={columns}
          valueKey="columns"
          setValue={setColumns}
          min={1}
          max={50}
          step={1}
        />
        <div className="flex items-start justify-between mt-5">
          <Label className="text-xs text-gray-600">Orientation</Label>
          <RadioGroup defaultValue={layout} onValueChange={setLayout}>
            <div className="flex items-center gap-3">
              <RadioGroupItem value="portrait" id="r1" />
              <Label htmlFor="r1" className="text-xs">
                Portrait
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <RadioGroupItem value="landscape" id="r2" />
              <Label htmlFor="r2" className="text-xs">
                Landscape
              </Label>
            </div>
          </RadioGroup>
        </div>
      </div>
    </CollapsibleToolbar>
  )
}

export function SpacingToolbar() {
  const {
    gapX,
    gapY,
    marginX,
    marginY,
    setGapX,
    setGapY,
    setMarginX,
    setMarginY,
  } = useDocumentStore()

  return (
    <CollapsibleToolbar name="Spacing" icon={<MoveIcon className="size-4" />}>
      <div className="space-y-3">
        <NumberControl
          label="Margin X"
          value={marginX}
          valueKey="marginX"
          setValue={setMarginX}
          min={0}
          max={80}
          step={5}
        />
        <NumberControl
          label="Margin Y"
          value={marginY}
          valueKey="marginY"
          setValue={setMarginY}
          min={0}
          max={80}
          step={5}
        />
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
    </CollapsibleToolbar>
  )
}
