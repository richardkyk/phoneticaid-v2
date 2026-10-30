import { useEffect } from 'react'
import { Loader, XIcon } from 'lucide-react'
import { useCameraStore } from '@/lib/stores/camera-store'
import { useCursorStore } from '@/lib/stores/cursor-store'
import { useTranslateStore } from '@/lib/stores/translate-store'
import type { DocumentStore } from '@/lib/stores/document-store'
import type { Layout } from '@/lib/layout'
import { popoverStyle } from '@/lib/popover'
import { rangePinyin } from '@/lib/words'
import type { TextAnalysis } from '@/lib/words'
import { toDisplayScript } from '@/lib/script'
import { providerLabel } from '@/lib/translate/providers'
import { Button } from './ui/button'

const WIDTH = 320
// px between a finger's selection and the popover, clear of its handle
const TOUCH_GAP = 24

interface TranslationPopoverProps {
  document: DocumentStore
  layout: Layout
  analysis: TextAnalysis
}
// The translation of the selection, shown just past its last character. It
// follows the text as the canvas is panned or zoomed and closes when the
// selection changes.
export function TranslationPopover(props: TranslationPopoverProps) {
  const { document, layout, analysis } = props
  const enabled = useTranslateStore((state) => state.translate)
  const translation = useTranslateStore((state) =>
    state.current
      ? Object.values(state.history)
          .flat()
          .find((t) => t.id === state.current)
      : undefined,
  )
  const pending = useTranslateStore(
    (state) => !!translation && state.pending.includes(translation.id),
  )
  const camera = useCameraStore()
  // only shown while its text is still selected
  useCursorStore((state) => state.selectionStart)
  useCursorStore((state) => state.selectionEnd)
  const selection = useCursorStore.getState().getSelection()
  const touchSelection = useCursorStore((state) => state.touchSelection)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useTranslateStore.getState().dismiss()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (!enabled || !translation || !selection) return null
  if (
    selection.start.index !== translation.start ||
    selection.end.index !== translation.end
  ) {
    return null
  }

  // beside the last selected character
  const style = popoverStyle(
    document,
    layout,
    camera,
    translation.end - 1,
    WIDTH,
    touchSelection ? TOUCH_GAP : undefined,
  )
  // the selection has been panned out of view
  if (!style) return null

  const pinyin = rangePinyin(analysis, translation.start, translation.end)

  return (
    <div
      className="absolute z-10 flex flex-col gap-1 overflow-y-auto rounded-lg border bg-popover p-3 text-sm shadow-lg print:hidden"
      style={style}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-chinese text-base whitespace-pre-line">
            {toDisplayScript(translation.original, document.script)}
          </div>
          {pinyin && (
            <div className="text-xs text-muted-foreground">{pinyin}</div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="-mt-1 -mr-1 size-6"
          onClick={() => useTranslateStore.getState().dismiss()}
          title="Close (Esc)"
        >
          <XIcon className="size-3.5" />
        </Button>
      </div>
      <div className="whitespace-pre-line">
        {pending && <Loader className="size-4 animate-spin" />}
        {translation.translation}
        {!pending && !translation.translation && !translation.error && (
          <span className="italic text-muted-foreground">
            No translation needed
          </span>
        )}
        {translation.error && (
          <span className="text-destructive">
            Translation failed: {translation.error}
          </span>
        )}
      </div>
      {translation.provider && (
        <div className="text-xs text-muted-foreground">
          via {providerLabel(translation.provider)}
        </div>
      )}
    </div>
  )
}
