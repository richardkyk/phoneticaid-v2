import { DocumentState, useDocumentStore } from '@/lib/stores/document-store'
import { Button } from './ui/button'
import {
  BookOpenIcon,
  BugIcon,
  ChevronDownIcon,
  LanguagesIcon,
  LayoutIcon,
  MinusIcon,
  PanelLeftDashedIcon,
  PlusIcon,
  PrinterIcon,
  RedoIcon,
  TypeIcon,
  UndoIcon,
} from 'lucide-react'
import { useHistoryStore } from '@/lib/stores/history-store'
import { ButtonGroup } from './ui/button-group'
import { cn } from '@/lib/utils'
import { getLayout } from '@/lib/layout'
import { getAnalysis } from '@/lib/words'
import { getDisplayText, scripts } from '@/lib/script'
import type { Script } from '@/lib/script'
import { isVertical, writingModes } from '@/lib/geometry'
import type { WritingMode } from '@/lib/geometry'
import { Page } from './page'
import { createRoot } from 'react-dom/client'
import { RadioGroup, RadioGroupItem } from './ui/radio-group'
import { Label } from './ui/label'
import { HoldButton } from './hold-button'
import { toast } from 'sonner'
import { CollapsibleToolbar } from './collapsible-toolbar'
import { useProjectsStore } from '@/lib/stores/projects-store'
import { useTranslateStore } from '@/lib/stores/translate-store'
import { Switch } from './ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import type { PinyinMode } from '@/lib/words'

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
        const pt = useProjectsStore.getState().getActiveProject().pt
        const layout = getLayout(pt, documentStore.columns)
        const analysis = getAnalysis(pt)
        const display = getDisplayText(pt, documentStore.script)
        const linesPerPage = documentStore.linesPerPage()
        const pages = []

        for (let i = 0; i < layout.rows.length; i += linesPerPage) {
          pages.push(layout.rows.slice(i, i + linesPerPage))
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
                layout={layout}
                analysis={analysis}
                display={display}
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
  const { translate, toggleTranslate } = useTranslateStore()
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
    <div className="flex items-center gap-1">
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
      <PrintButton />
      <TranslateButton />
      <DebugButton />
    </div>
  )
}

export function TextToolbar() {
  const {
    fontSize,
    pinyinSize,
    pinyinOffset,
    pinyinPosition,
    pinyinSide,
    writingMode,
    script,
    setDocumentAttribute,
  } = useDocumentStore()

  return (
    <CollapsibleToolbar name="Text" icon={<TypeIcon className="size-4" />}>
      <div className="space-y-3 font-sans">
        <NumberControl
          label="Font Size"
          value={fontSize}
          valueKey="fontSize"
          setValue={(v) => setDocumentAttribute({ fontSize: v })}
          min={1}
          max={100}
          step={1}
        />
        <NumberControl
          label="Pinyin Size"
          value={pinyinSize}
          valueKey="pinyinSize"
          setValue={(v) => setDocumentAttribute({ pinyinSize: v })}
          min={0}
          max={20}
          step={0.1}
          decimalPoints={1}
        />
        <NumberControl
          label="Pinyin Offset"
          value={pinyinOffset}
          valueKey="pinyinOffset"
          setValue={(v) => setDocumentAttribute({ pinyinOffset: v })}
          min={0}
          max={20}
          step={0.1}
          decimalPoints={1}
        />
        <div className="flex items-start mt-5 justify-between">
          <Label className="text-xs text-gray-600">Characters</Label>
          <RadioGroup
            value={script}
            onValueChange={(v) => setDocumentAttribute({ script: v as Script })}
          >
            {scripts.map((s) => (
              <div key={s.value} className="flex items-center gap-3">
                <RadioGroupItem value={s.value} id={`script-${s.value}`} />
                <Label htmlFor={`script-${s.value}`} className="text-xs">
                  {s.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        <div className="flex items-start mt-5 justify-between">
          <Label className="text-xs text-gray-600">Pinyin Position</Label>
          {isVertical(writingMode) ? (
            <RadioGroup
              value={pinyinSide}
              onValueChange={(v) =>
                setDocumentAttribute({ pinyinSide: v as 'left' | 'right' })
              }
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="right" id="pinyin-right" />
                <Label htmlFor="pinyin-right" className="text-xs">
                  Right
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="left" id="pinyin-left" />
                <Label htmlFor="pinyin-left" className="text-xs">
                  Left
                </Label>
              </div>
            </RadioGroup>
          ) : (
            <RadioGroup
              value={pinyinPosition}
              onValueChange={(v) =>
                setDocumentAttribute({ pinyinPosition: v as 'top' | 'bottom' })
              }
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
          )}
        </div>
      </div>
    </CollapsibleToolbar>
  )
}

export function LayoutToolbar() {
  const { columns, layout, writingMode, setColumns, setDocumentAttribute } =
    useDocumentStore()

  return (
    <CollapsibleToolbar name="Layout" icon={<LayoutIcon className="size-4" />}>
      <div className="space-y-3">
        <NumberControl
          // characters per line, which is a column in vertical modes
          label={isVertical(writingMode) ? 'Rows' : 'Columns'}
          value={columns}
          valueKey="columns"
          setValue={setColumns}
          min={1}
          max={50}
          step={1}
        />
        <div className="flex items-start justify-between mt-5">
          <Label className="text-xs text-gray-600">Orientation</Label>
          <RadioGroup
            value={layout}
            onValueChange={(v) =>
              setDocumentAttribute({ layout: v as 'portrait' | 'landscape' })
            }
          >
            <div className="flex items-center gap-3">
              <RadioGroupItem value="portrait" id="r3" />
              <Label htmlFor="r3" className="text-xs">
                Portrait
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <RadioGroupItem value="landscape" id="r4" />
              <Label htmlFor="r4" className="text-xs">
                Landscape
              </Label>
            </div>
          </RadioGroup>
        </div>
        <div className="flex items-start justify-between mt-5">
          <Label className="text-xs text-gray-600">Direction</Label>
          <RadioGroup
            value={writingMode}
            onValueChange={(v) =>
              setDocumentAttribute({ writingMode: v as WritingMode })
            }
          >
            {writingModes.map((mode) => (
              <div key={mode.value} className="flex items-center gap-3">
                <RadioGroupItem value={mode.value} id={mode.value} />
                <Label htmlFor={mode.value} className="text-xs">
                  {mode.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      </div>
    </CollapsibleToolbar>
  )
}

export function SpacingToolbar() {
  const { gapX, gapY, marginX, marginY, setDocumentAttribute } =
    useDocumentStore()

  return (
    <CollapsibleToolbar
      name="Spacing"
      icon={<PanelLeftDashedIcon className="size-4" />}
    >
      <div className="space-y-3">
        <NumberControl
          label="Margin X"
          value={marginX}
          valueKey="marginX"
          setValue={(v) => setDocumentAttribute({ marginX: v })}
          min={0}
          max={80}
          step={5}
        />
        <NumberControl
          label="Margin Y"
          value={marginY}
          valueKey="marginY"
          setValue={(v) => setDocumentAttribute({ marginY: v })}
          min={0}
          max={80}
          step={5}
        />
        <NumberControl
          label="Gap X"
          value={gapX}
          valueKey="gapX"
          setValue={(v) => setDocumentAttribute({ gapX: v })}
          min={0}
          max={30}
          step={0.1}
          decimalPoints={1}
        />
        <NumberControl
          label="Gap Y"
          value={gapY}
          valueKey="gapY"
          setValue={(v) => setDocumentAttribute({ gapY: v })}
          min={0}
          max={30}
          step={0.1}
          decimalPoints={1}
        />
      </div>
    </CollapsibleToolbar>
  )
}

// HSK levels whose words can have their pinyin hidden
const HSK_LEVELS = [1, 2, 3, 4, 5, 6]

// the pinyin setting as a single choice: 'all', 'none' or an HSK level
const pinyinChoice = (mode: PinyinMode, level: number) =>
  mode === 'unknown' ? String(level) : mode

const pinyinChoiceLabel = (choice: string) => {
  if (choice === 'all') return 'None'
  if (choice === 'none') return 'Hide all pinyin'
  return `HSK ${choice}`
}

// What's shown to help reading. Pages print the way they're shown, while
// hidden pinyin revealed by hovering, tapping, selecting or holding Alt isn't.
export function ReadingToolbar() {
  const { wordGroups, pinyinMode, hskLevel, setDocumentAttribute } =
    useDocumentStore()
  const choice = pinyinChoice(pinyinMode, hskLevel)

  const setChoice = (value: string) => {
    if (value === 'all' || value === 'none') {
      setDocumentAttribute({ pinyinMode: value })
    } else {
      setDocumentAttribute({ pinyinMode: 'unknown', hskLevel: Number(value) })
    }
  }

  return (
    <CollapsibleToolbar
      name="Reading aids"
      icon={<BookOpenIcon className="size-4" />}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="word-groups" className="text-xs text-gray-600">
            Group words
          </Label>
          <Switch
            id="word-groups"
            checked={wordGroups}
            onCheckedChange={(v) => setDocumentAttribute({ wordGroups: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-gray-600">HSK level</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs">
                {pinyinChoiceLabel(choice)}
                <ChevronDownIcon className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup value={choice} onValueChange={setChoice}>
                {['all', ...HSK_LEVELS.map(String), 'none'].map((value) => (
                  <DropdownMenuRadioItem
                    key={value}
                    value={value}
                    className="text-xs"
                  >
                    {pinyinChoiceLabel(value)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-xs text-muted-foreground">
          Pinyin is hidden for words at your HSK level and below. Hover or tap a
          word, or hold Alt, to see it
        </p>
      </div>
    </CollapsibleToolbar>
  )
}
