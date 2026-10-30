import { useEffect, useState } from 'react'
import { Loader } from 'lucide-react'
import { useCameraStore } from '@/lib/stores/camera-store'
import { useCursorStore } from '@/lib/stores/cursor-store'
import { useRevealStore } from '@/lib/stores/reveal-store'
import { useUiStore } from '@/lib/stores/ui-store'
import type { DocumentStore } from '@/lib/stores/document-store'
import type { Layout } from '@/lib/layout'
import { popoverStyle } from '@/lib/popover'
import { lookUp, useDictionaryStore } from '@/lib/dictionary'
import { rangePinyin } from '@/lib/words'
import type { TextAnalysis } from '@/lib/words'
import { toDisplayScript } from '@/lib/script'

const WIDTH = 280
// how long the pointer rests on a word before its card is shown
const DELAY = 300
// meanings shown per reading
const MAX_MEANINGS = 6

// The word under the pointer (or last tapped) whose card is shown, once it's
// been there a moment. Typing hides it until another word is hovered.
function useCardWord(analysis: TextAnalysis) {
  const hovered = useRevealStore((state) => state.hovered)
  const word = hovered === null ? -1 : (analysis.wordAt[hovered] ?? -1)
  const [shown, setShown] = useState(-1)

  useEffect(() => {
    setShown(-1)
    if (word === -1) return
    const timer = setTimeout(() => setShown(word), DELAY)
    return () => clearTimeout(timer)
  }, [word])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt is for peeking at the pinyin
      if (!['Alt', 'Shift', 'Control', 'Meta'].includes(e.key)) setShown(-1)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return shown === word ? analysis.words[word] : undefined
}

interface DictionaryCardProps {
  document: DocumentStore
  layout: Layout
  analysis: TextAnalysis
}
// The meanings of the word under the pointer (or tapped), beside it. Not
// shown while text is selected, which has the translation instead.
export function DictionaryCard(props: DictionaryCardProps) {
  const { document, layout, analysis } = props
  const enabled = useUiStore((state) => state.dictionary)
  const dictionary = useDictionaryStore((state) => state.dictionary)
  const camera = useCameraStore()
  const selecting = useCursorStore(
    (state) =>
      !!state.selectionStart &&
      !!state.selectionEnd &&
      state.selectionStart.index !== state.selectionEnd.index,
  )
  const word = useCardWord(analysis)
  const showing = enabled && !selecting && !!word

  useEffect(() => {
    if (showing) useDictionaryStore.getState().load()
  }, [showing])

  if (!showing) return null

  const style = popoverStyle(document, layout, camera, word.start, WIDTH)
  if (!style) return null

  const pinyin = rangePinyin(analysis, word.start, word.end)
  const readings = dictionary ? lookUp(dictionary, word.text, pinyin) : []

  return (
    <div
      className="pointer-events-none absolute z-10 flex flex-col gap-2 overflow-hidden rounded-lg border bg-popover p-3 text-sm shadow-lg print:hidden"
      style={style}
    >
      <div className="font-chinese text-base">
        {toDisplayScript(word.text, document.script)}
      </div>
      {!dictionary && <Loader className="size-4 animate-spin" />}
      {dictionary && readings.length === 0 && (
        <div>
          <div className="text-xs text-muted-foreground">{pinyin}</div>
          <div className="italic text-muted-foreground">No meanings listed</div>
        </div>
      )}
      {readings.map((reading) => (
        <div key={reading.pinyin}>
          <div className="text-xs text-muted-foreground">{reading.pinyin}</div>
          <div>
            {reading.meanings.slice(0, MAX_MEANINGS).join('; ')}
            {reading.meanings.length > MAX_MEANINGS && '…'}
          </div>
        </div>
      ))}
    </div>
  )
}
