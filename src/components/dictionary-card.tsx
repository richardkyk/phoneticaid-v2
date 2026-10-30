import { useEffect, useState } from 'react'
import { Check, Loader } from 'lucide-react'
import { useCameraStore } from '@/lib/stores/camera-store'
import { useCursorStore } from '@/lib/stores/cursor-store'
import { useRevealStore } from '@/lib/stores/reveal-store'
import { useUiStore } from '@/lib/stores/ui-store'
import { useProjectsStore } from '@/lib/stores/projects-store'
import { pickReading } from '@/lib/stores/readings-store'
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
import type { ReadingOption } from '@/lib/dictionary'
import { getText } from '@/lib/piece-table'
import type { TextAnalysis } from '@/lib/words'
import { cn } from '@/lib/utils'
import { toDisplayScript } from '@/lib/script'

const WIDTH = 280
// how long the pointer rests on a word before its card is shown
const DELAY = 300
// meanings shown per reading
const MAX_MEANINGS = 6

// The word under the pointer (or last tapped) whose card is shown, once it's
// been there a moment. It stays while the pointer is on the card (`holding`),
// so a reading can be picked. Typing hides it until another word is hovered.
function useCardWord(analysis: TextAnalysis, holding: boolean) {
  const hovered = useRevealStore((state) => state.hovered)
  const word = hovered === null ? -1 : (analysis.wordAt[hovered] ?? -1)
  const [shown, setShown] = useState(-1)

  // the card changes (or goes) a moment after the pointer moves, which gives
  // it time to get onto the card
  useEffect(() => {
    if (holding || word === shown) return
    const timer = setTimeout(() => setShown(word), DELAY)
    return () => clearTimeout(timer)
  }, [word, shown, holding])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt is for peeking at the pinyin
      if (!['Alt', 'Shift', 'Control', 'Meta'].includes(e.key)) setShown(-1)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return shown === -1 ? undefined : analysis.words[shown]
}

// Whether the word from `start` to `end` in the active project has a reading
// picked for it
function isPicked(start: number, end: number) {
  const { pt, pickedReadings } = useProjectsStore.getState().getActiveProject()
  if (!pickedReadings) return false
  const text = getText(pt)
  const paragraphStart = text.lastIndexOf('\n', start - 1) + 1
  const paragraphEnd = text.indexOf('\n', start)
  const picked =
    pickedReadings[
      text.slice(
        paragraphStart,
        paragraphEnd === -1 ? text.length : paragraphEnd,
      )
    ]
  if (!picked) return false
  for (let i = start; i < end; i++) {
    if (picked[i - paragraphStart] !== undefined) return true
  }
  return false
}

interface PinyinButtonProps {
  option: ReadingOption
  current: boolean
  // there's nothing to choose between
  only: boolean
  onPick: () => void
}
function PinyinButton(props: PinyinButtonProps) {
  const { option, current, only, onPick } = props
  const text = option.syllables.join('')
  if (only) return <span className="text-xs text-muted-foreground">{text}</span>
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1 rounded px-1 -mx-1 text-xs hover:bg-accent',
        current ? 'font-medium text-foreground' : 'text-muted-foreground',
      )}
      title={current ? 'The reading used' : 'Use this reading here'}
      onClick={onPick}
    >
      {text}
      {option.note && <span className="font-normal">({option.note})</span>}
      {current && <Check className="size-3" />}
    </button>
  )
}

interface DictionaryCardProps {
  document: DocumentStore
  layout: Layout
  analysis: TextAnalysis
}
// The meanings of the word under the pointer (or tapped), beside it, from
// CC-CEDICT (credited on the card, as its license asks), and its readings,
// which can be picked for the word in this spot. Not shown while text is
// selected, which has the translation instead.
export function DictionaryCard(props: DictionaryCardProps) {
  const { document, layout, analysis } = props
  const enabled = useUiStore((state) => state.dictionary)
  const camera = useCameraStore()
  const selecting = useCursorStore(
    (state) =>
      !!state.selectionStart &&
      !!state.selectionEnd &&
      state.selectionStart.index !== state.selectionEnd.index,
  )
  // the pointer's on the card
  const [holding, setHolding] = useState(false)
  const word = useCardWord(analysis, holding)
  const showing = enabled && !selecting && !!word
  const form = word ? dictionaryForm(word.text) : ''
  const shard = word ? shardOf(form) : -1
  const dictionary = useDictionaryStore((state) => state.shards[shard])

  useEffect(() => {
    if (showing) useDictionaryStore.getState().load(shard)
  }, [showing, shard])
  useEffect(() => {
    if (!showing) setHolding(false)
  }, [showing])

  if (!showing) return null

  const style = popoverStyle(document, layout, camera, word.start, WIDTH)
  if (!style) return null

  const length = word.end - word.start
  // one syllable per character
  const pinyin = analysis.pinyin.slice(word.start, word.end).join(' ')
  const readings = dictionary ? lookUp(dictionary, form, pinyin) : []
  const options = readingOptions(readings, length)
  const others = options.filter((o) => o.note)
  // the reading the word has here; 一 and 不 are written as they're said
  const current =
    options.find((o) => o.syllables.join(' ') === pinyin) ??
    options.find(
      (o) => plainPinyin(o.syllables.join(' ')) === plainPinyin(pinyin),
    )
  const picked = isPicked(word.start, word.end)
  const only = options.length < 2 && !picked
  const pick = (option: ReadingOption) => {
    if (option === current) return
    pickReading(word.start, word.end, option.syllables)
  }

  return (
    <div
      className="absolute z-10 flex flex-col gap-2 overflow-hidden rounded-lg border bg-popover p-3 text-sm shadow-lg print:hidden"
      style={style}
      onPointerEnter={() => setHolding(true)}
      onPointerLeave={() => setHolding(false)}
      // the text keeps the keyboard
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="font-chinese text-base">
        {toDisplayScript(word.text, document.script)}
      </div>
      {!dictionary && <Loader className="size-4 animate-spin" />}
      {dictionary && readings.length === 0 && (
        <div>
          <div className="text-xs text-muted-foreground">
            {pinyin.replaceAll(' ', '')}
          </div>
          <div className="italic text-muted-foreground">No meanings listed</div>
        </div>
      )}
      {readings.map((reading) => {
        const option = options.find(
          (o) => o.syllables.join(' ') === reading.pinyin,
        )
        return (
          <div key={reading.pinyin}>
            {option ? (
              <PinyinButton
                option={option}
                current={option === current}
                only={only}
                onPick={() => pick(option)}
              />
            ) : (
              <div className="text-xs text-muted-foreground">
                {reading.pinyin.replaceAll(' ', '')}
              </div>
            )}
            <div>
              {reading.meanings.slice(0, MAX_MEANINGS).join('; ')}
              {reading.meanings.length > MAX_MEANINGS && '…'}
            </div>
          </div>
        )
      })}
      {others.length > 0 && (
        <div className="flex flex-wrap gap-x-3">
          {others.map((option) => (
            <PinyinButton
              key={option.syllables.join(' ')}
              option={option}
              current={option === current}
              only={false}
              onPick={() => pick(option)}
            />
          ))}
        </div>
      )}
      {(readings.length > 0 || picked) && (
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          {readings.length > 0 && <span>CC-CEDICT</span>}
          {picked && (
            <button
              type="button"
              className="ml-auto underline-offset-2 hover:underline"
              onClick={() => pickReading(word.start, word.end, null)}
            >
              Use the usual reading
            </button>
          )}
        </div>
      )}
    </div>
  )
}
