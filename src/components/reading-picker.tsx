import { useEffect, useRef } from 'react'
import { Check, Loader } from 'lucide-react'
import { useCameraStore } from '@/lib/stores/camera-store'
import {
  pickReading,
  pickedReading,
  useReadingsStore,
} from '@/lib/stores/readings-store'
import { useProjectsStore } from '@/lib/stores/projects-store'
import type { DocumentStore } from '@/lib/stores/document-store'
import type { Layout } from '@/lib/layout'
import { popoverStyle } from '@/lib/popover'
import {
  dictionaryForm,
  lookUp,
  plainPinyin,
  readingOptions,
  shardOf,
  useDictionaryStore,
} from '@/lib/dictionary'
import type { TextAnalysis } from '@/lib/words'
import { toDisplayScript } from '@/lib/script'
import { cn } from '@/lib/utils'

const WIDTH = 220

interface ReadingPickerProps {
  document: DocumentStore
  layout: Layout
  analysis: TextAnalysis
}
// The readings of the character whose pinyin was clicked (see editor.tsx),
// from CC-CEDICT, to pick the one it has in this spot. A picked reading wins
// over the others (see words.ts).
export function ReadingPicker(props: ReadingPickerProps) {
  const { document, layout, analysis } = props
  const index = useReadingsStore((state) => state.picking)
  const camera = useCameraStore()
  // re-rendered when a reading is picked
  useProjectsStore((state) => state.getActiveProject().pickedReadings)
  // characters with pinyin are all in words
  const word =
    index === null ? undefined : analysis.words[analysis.wordAt[index]]
  const char = word && index !== null ? word.text[index - word.start] : ''
  const form = dictionaryForm(char)
  const shard = shardOf(form)
  const dictionary = useDictionaryStore((state) => state.shards[shard])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (index !== null) useDictionaryStore.getState().load(shard)
  }, [index, shard])

  useEffect(() => {
    if (index === null) return
    const close = () => useReadingsStore.getState().setPicking(null)
    const handlePointerDown = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node)) return
      close()
      // clicking the same pinyin again only closes it, rather than the
      // editor opening it again
      const pinyin = (e.target as HTMLElement).closest<HTMLElement>(
        '[data-pinyin]',
      )
      if (pinyin?.dataset.index === String(index)) e.stopPropagation()
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!['Alt', 'Shift', 'Control', 'Meta'].includes(e.key)) close()
    }
    // before the editor, which opens it again for another character
    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [index])

  if (index === null || !char) return null
  const style = popoverStyle(document, layout, camera, index, WIDTH)
  if (!style) return null

  const pinyin = analysis.pinyin[index]
  const readings = dictionary ? lookUp(dictionary, form, pinyin) : []
  const options = readingOptions(readings, 1).map((option) => {
    const syllable = option.syllables[0]
    const reading = readings.find((r) => r.pinyin === syllable)
    return { syllable, gloss: option.note ?? reading?.meanings[0] ?? '' }
  })
  // the reading it has, even if the dictionary doesn't list it; 一 and 不
  // are written as they're said
  const current =
    options.find((o) => o.syllable === pinyin) ??
    options.find((o) => plainPinyin(o.syllable) === plainPinyin(pinyin))
  if (!current && pinyin) options.unshift({ syllable: pinyin, gloss: '' })
  const picked = pickedReading(index) !== undefined

  const pick = (syllable: string) => {
    if (syllable !== pinyin) pickReading(index, syllable)
    useReadingsStore.getState().setPicking(null)
  }

  return (
    <div
      ref={ref}
      className="absolute z-20 flex flex-col overflow-hidden rounded-lg border bg-popover p-1 text-sm shadow-lg print:hidden"
      style={style}
      // the text keeps the keyboard
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="px-2 pt-1 pb-1.5 font-chinese text-base">
        {toDisplayScript(char, document.script)}
      </div>
      {!dictionary && <Loader className="m-2 size-4 animate-spin" />}
      {dictionary &&
        options.map(({ syllable, gloss }) => {
          const isCurrent = syllable === (current?.syllable ?? pinyin)
          return (
            <button
              key={syllable}
              type="button"
              className={cn(
                'flex items-center gap-2 rounded px-2 py-1 text-left hover:bg-accent',
                isCurrent && 'font-medium',
              )}
              onClick={() => pick(syllable)}
            >
              <span className="w-12 shrink-0">{syllable}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {gloss}
              </span>
              {isCurrent && <Check className="size-3.5 shrink-0" />}
            </button>
          )
        })}
      {picked && (
        <button
          type="button"
          className="mt-1 rounded border-t px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent"
          onClick={() => {
            pickReading(index, null)
            useReadingsStore.getState().setPicking(null)
          }}
        >
          Use the usual reading
        </button>
      )}
    </div>
  )
}
