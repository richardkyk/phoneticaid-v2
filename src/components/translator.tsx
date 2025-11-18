import { useTranslateStore } from '@/lib/stores/translate-store'
import { GripVerticalIcon, Loader, XIcon } from 'lucide-react'
import { ScrollArea } from './ui/scroll-area'
import { Fragment } from 'react/jsx-runtime'
import { Separator } from './ui/separator'
import { useEffect, useRef } from 'react'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'
import { useDraggableOverlay } from '@/lib/hooks/use-draggable-overlay'

export function Translator() {
  const scrollRef = useRef<HTMLDivElement>(null)

  const enableTranslate = useTranslateStore((state) => state.translate)
  const translations = useTranslateStore((state) => state.translations)
  const isTranslating = useTranslateStore((state) => state.isThinking)
  const toggleTranslate = useTranslateStore((state) => state.toggleTranslate)

  const { overlayRef, handleMouseDown, startResize } = useDraggableOverlay()

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollIntoView({ behavior: 'smooth' }) //Use scrollIntoView to automatically scroll to my ref
  }, [translations])

  if (!enableTranslate) return null

  return (
    <div
      ref={overlayRef}
      className={cn(
        'font-sans bg-white flex flex-col rounded-xl shadow-lg border w-[400px] z-10 fixed h-[calc(50vh)]',
      )}
    >
      <div className="p-2 flex items-center border-b">
        <Button variant="ghost" size="icon-sm" onMouseDown={handleMouseDown}>
          <GripVerticalIcon className="size-4" />
        </Button>
        <h4 className="leading-none font-bold">Translations</h4>
        <Button
          className="ml-auto"
          variant="ghost"
          size="icon-sm"
          onClick={() => toggleTranslate()}
        >
          <XIcon className="size-4" />
        </Button>
      </div>
      <ScrollArea className="py-2 min-h-0 flex-1 w-full">
        {translations.length === 0 && (
          <div className="italic px-4">Highlight text to translate</div>
        )}
        {translations.map((t, idx) => (
          <Fragment key={idx + t.original}>
            <Separator className={cn('my-2 px-4', idx === 0 && 'hidden')} />
            <div className="whitespace-pre-line px-4 mb-1 text-muted-foreground">
              {t.original}
            </div>
            <div className="relative whitespace-pre-line px-4">
              {t.translation}
              {isTranslating && idx === translations.length - 1 && (
                <Loader className="size-4 mt-2 animate-spin" />
              )}
            </div>
          </Fragment>
        ))}
        <div ref={scrollRef} className="mb-4" />
      </ScrollArea>
      <div
        onMouseDown={(e) => startResize(e, 'right')}
        className="group/parent absolute right-0.5 bottom-2 top-12 w-1 flex items-center cursor-ew-resize"
      >
        <div className="w-1 h-16 group-hover/parent:bg-gray-400 bg-gray-100 rounded-full" />
      </div>

      <div
        onMouseDown={(e) => startResize(e, 'bottom')}
        className="group/parent absolute bottom-0.5 inset-x-2 h-1 flex justify-center cursor-ns-resize"
      >
        <div className="h-1 w-16 group-hover/parent:bg-gray-400 bg-gray-100 rounded-full" />
      </div>
      <div
        onMouseDown={(e) => startResize(e, 'corner')}
        className="absolute bottom-0.5 right-0.5 cursor-nwse-resize flex items-end justify-end group"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 26 26"
          className="pointer-events-none"
        >
          <path
            d="M 4 24 H 14 A 10 10 0 0 0 24 14 V 4"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
            className="text-gray-100 group-hover:text-gray-400"
          />
        </svg>
      </div>
    </div>
  )
}
