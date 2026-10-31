import { DocumentState, useDocumentStore } from '@/lib/stores/document-store'
import { Button } from './ui/button'
import {
  ChevronDownIcon,
  InfoIcon,
  Loader,
  LayoutIcon,
  MinusIcon,
  PanelLeftDashedIcon,
  PlusIcon,
  PrinterIcon,
  RedoIcon,
  SpeechIcon,
  TypeIcon,
  UndoIcon,
} from 'lucide-react'
import { useHistoryStore } from '@/lib/stores/history-store'
import { ButtonGroup } from './ui/button-group'
import { getLayout } from '@/lib/layout'
import { getAnalysis } from '@/lib/words'
import { useLexiconStore } from '@/lib/hsk'
import { getDisplayText, scripts } from '@/lib/script'
import { isVertical, writingModes } from '@/lib/geometry'
import { Page } from './page'
import { createRoot } from 'react-dom/client'
import { Label } from './ui/label'
import { HoldButton } from './hold-button'
import { flushSync } from 'react-dom'
import { toast } from 'sonner'
import { CollapsibleToolbar } from './collapsible-toolbar'
import { AccountMenu } from './account-menu'
import { useProjectsStore } from '@/lib/stores/projects-store'
import { Switch } from './ui/switch'
import { useUiStore } from '@/lib/stores/ui-store'
import { useReadingsStore } from '@/lib/stores/readings-store'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
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
      <ControlLabel label={label} />
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

interface ControlLabelProps {
  label: string
  // explains the setting, shown when hovering the (i)
  hint?: string
  htmlFor?: string
}
export function ControlLabel({ label, hint, htmlFor }: ControlLabelProps) {
  return (
    <div className="flex items-center gap-1">
      <Label htmlFor={htmlFor} className="text-xs text-gray-600">
        {label}
      </Label>
      {hint && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              aria-label={hint}
            >
              <InfoIcon className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-56">
            {hint}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}

interface SwitchControlProps {
  id: string
  label: string
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
}
export function SwitchControl(props: SwitchControlProps) {
  return (
    // as tall as the rows with buttons
    <div className="flex h-8 items-center justify-between">
      <ControlLabel label={props.label} htmlFor={props.id} hint={props.hint} />
      <Switch
        id={props.id}
        checked={props.checked}
        onCheckedChange={props.onChange}
      />
    </div>
  )
}

interface SelectControlProps<T extends string> {
  label: string
  value: T
  // shortLabel is shown on the button when the label is too long for it
  options: ReadonlyArray<{ value: T; label: string; shortLabel?: string }>
  onChange: (value: T) => void
  hint?: string
}
function SelectControl<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: SelectControlProps<T>) {
  const selected = options.find((o) => o.value === value)
  return (
    <div className="flex items-center justify-between gap-2">
      <ControlLabel label={label} hint={hint} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {/* as wide as a number control */}
          <Button
            variant="outline"
            size="sm"
            className="w-28 justify-between text-xs shadow-none"
          >
            <span className="truncate">
              {selected?.shortLabel ?? selected?.label}
            </span>
            <ChevronDownIcon className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup
            value={value}
            onValueChange={(v) => onChange(v as T)}
          >
            {options.map((option) => (
              <DropdownMenuRadioItem
                key={option.value}
                value={option.value}
                className="text-xs"
              >
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

interface DisabledProps {
  disabled: boolean
  children: React.ReactNode
}
// Greys out controls that have no effect
function Disabled({ disabled, children }: DisabledProps) {
  if (!disabled) return children
  return (
    <div inert className="space-y-3 opacity-50">
      {children}
    </div>
  )
}

interface PrintButtonProps {
  className?: string
}
// Renders every page into a container that's only shown when printing (see
// styles.css) and prints straight from the click, as iOS Safari ignores
// print() once the tap has been handled
function PrintButton(props: PrintButtonProps) {
  const handlePrint = () => {
    // left in place after printing, as iOS reports the print finished before
    // it has used the pages, so it's replaced on the next print instead
    document.getElementById('print-root')?.remove()
    const container = document.createElement('div')
    container.id = 'print-root'
    document.body.appendChild(container)

    const documentStore = useDocumentStore.getState()
    const { pt, readings, pickedReadings } = useProjectsStore
      .getState()
      .getActiveProject()
    const layout = getLayout(pt, documentStore.columns)
    const analysis = getAnalysis(
      pt,
      useLexiconStore.getState().lexicon,
      readings,
      pickedReadings,
    )
    const display = getDisplayText(pt, documentStore.script)
    const linesPerPage = documentStore.linesPerPage()
    const pages: (typeof layout.rows)[] = []
    for (let i = 0; i < layout.rows.length; i += linesPerPage) {
      pages.push(layout.rows.slice(i, i + linesPerPage))
    }

    flushSync(() =>
      createRoot(container).render(
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
      ),
    )
    // browsers built into other apps (e.g. Arc Search on iOS) quietly ignore
    // print(), and never get as far as beforeprint
    let printing = false
    const handleBeforePrint = () => (printing = true)
    window.addEventListener('beforeprint', handleBeforePrint, { once: true })
    window.print()
    setTimeout(() => {
      window.removeEventListener('beforeprint', handleBeforePrint)
      if (!printing) {
        toast.error("This browser can't print", {
          description: 'Open the page in Safari or Chrome to print it.',
        })
      }
    }, 1000)
  }

  return (
    <Button
      variant="ghost"
      onClick={handlePrint}
      size="icon-sm"
      title="Print"
      className={props.className}
    >
      <PrinterIcon className="size-4" />
    </Button>
  )
}

// Undo, redo, printing and the account, at the top of the settings panel
export function DocumentToolbar() {
  const { past, future } = useHistoryStore()

  return (
    <div className="flex items-center gap-1 border-b p-2">
      <Button
        onClick={() => useHistoryStore.getState().undo()}
        size="icon-sm"
        variant="ghost"
        title="Undo"
        disabled={past.length === 0}
      >
        <UndoIcon />
      </Button>
      <Button
        onClick={() => useHistoryStore.getState().redo()}
        size="icon-sm"
        variant="ghost"
        title="Redo"
        disabled={future.length === 0}
      >
        <RedoIcon />
      </Button>
      <PrintButton className="ml-auto" />
      <AccountMenu icon />
    </div>
  )
}

export function TextToolbar() {
  const { fontSize, script, setDocumentAttribute } = useDocumentStore()

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
        <SelectControl
          label="Characters"
          hint="Shows the text in simplified or traditional characters. What you typed is kept, so you can switch back."
          value={script}
          options={scripts}
          onChange={(v) => setDocumentAttribute({ script: v })}
        />
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
        <SelectControl
          label="Orientation"
          value={layout}
          options={[
            { value: 'portrait', label: 'Portrait' },
            { value: 'landscape', label: 'Landscape' },
          ]}
          onChange={(v) => setDocumentAttribute({ layout: v })}
        />
        <SelectControl
          label="Direction"
          value={writingMode}
          options={writingModes}
          onChange={(v) => setDocumentAttribute({ writingMode: v })}
        />
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
  if (choice === 'none') return 'All'
  return `HSK ${choice}`
}

// The pinyin and what's shown to help reading. Pages print the way they're
// shown, while hidden pinyin revealed by hovering, tapping, selecting or
// holding Alt isn't.
export function PinyinToolbar() {
  const {
    showPinyin,
    pinyinPosition,
    pinyinSide,
    pinyinSize,
    pinyinOffset,
    writingMode,
    wordGroups,
    pinyinMode,
    hskLevel,
    setDocumentAttribute,
  } = useDocumentStore()
  const { dictionary, toggleDictionary } = useUiStore()
  const readingsProgress = useReadingsStore((state) => state.progress)
  const vertical = isVertical(writingMode)
  const choice = pinyinChoice(pinyinMode, hskLevel)

  const setChoice = (value: string) => {
    if (value === 'all' || value === 'none') {
      setDocumentAttribute({ pinyinMode: value })
    } else {
      setDocumentAttribute({ pinyinMode: 'unknown', hskLevel: Number(value) })
    }
  }

  // which side of the character, the options depending on the writing mode
  const position = !showPinyin ? 'off' : vertical ? pinyinSide : pinyinPosition
  const positions = vertical
    ? [
        { value: 'right', label: 'Right' },
        { value: 'left', label: 'Left' },
      ]
    : [
        { value: 'top', label: 'Above' },
        { value: 'bottom', label: 'Below' },
      ]
  const setPosition = (value: string) => {
    if (value === 'off') setDocumentAttribute({ showPinyin: false })
    else if (vertical) {
      setDocumentAttribute({
        showPinyin: true,
        pinyinSide: value as 'left' | 'right',
      })
    } else {
      setDocumentAttribute({
        showPinyin: true,
        pinyinPosition: value as 'top' | 'bottom',
      })
    }
  }

  return (
    <CollapsibleToolbar name="Pinyin" icon={<SpeechIcon className="size-4" />}>
      <div className="space-y-3">
        <SelectControl
          label="Position"
          hint="Off hides the pinyin but keeps its room on each line, e.g. for writing it in by hand."
          value={position}
          options={[...positions, { value: 'off', label: 'Off' }]}
          onChange={setPosition}
        />
        <NumberControl
          label="Size"
          value={pinyinSize}
          valueKey="pinyinSize"
          setValue={(v) => setDocumentAttribute({ pinyinSize: v })}
          min={0}
          max={20}
          step={0.1}
          decimalPoints={1}
        />
        <NumberControl
          label="Offset"
          value={pinyinOffset}
          valueKey="pinyinOffset"
          setValue={(v) => setDocumentAttribute({ pinyinOffset: v })}
          min={0}
          max={20}
          step={0.1}
          decimalPoints={1}
        />
        {/* pinyin that isn't shown can't be hidden or grouped */}
        <Disabled disabled={!showPinyin}>
          <SelectControl
            label="HSK level"
            hint="Pinyin is hidden for words at your HSK level and below. Hover or tap a word, or hold Alt, to see it."
            value={choice}
            options={['all', ...HSK_LEVELS.map(String), 'none'].map(
              (value) => ({ value, label: pinyinChoiceLabel(value) }),
            )}
            onChange={setChoice}
          />
          <SwitchControl
            id="word-groups"
            label="Group words"
            hint="A faint background behind each word of more than one character, for words still showing their pinyin."
            checked={wordGroups}
            onChange={(v) => setDocumentAttribute({ wordGroups: v })}
          />
        </Disabled>
        <div className="flex items-center justify-between gap-2">
          <ControlLabel
            label="AI readings"
            hint="Asks AI which reading characters like 得 (de, děi) and 还 (hái, huán) have here, using the translation provider. Each paragraph is checked once, until it's edited."
          />
          <Button
            variant="outline"
            size="sm"
            className="w-28 text-xs shadow-none"
            disabled={!!readingsProgress}
            onClick={() => useReadingsStore.getState().check()}
          >
            {readingsProgress ? (
              <>
                <Loader className="size-3 animate-spin" />
                {readingsProgress.total > 1 &&
                  `${readingsProgress.done + 1}/${readingsProgress.total}`}
              </>
            ) : (
              'Check'
            )}
          </Button>
        </div>
        <SwitchControl
          id="dictionary"
          label="Dictionary"
          hint="Rest the pointer on a word, or tap it, to see its meanings. Click or tap pinyin to change its reading."
          checked={dictionary}
          onChange={() => toggleDictionary()}
        />
      </div>
    </CollapsibleToolbar>
  )
}
