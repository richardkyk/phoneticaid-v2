import { useDocumentStore } from '@/lib/stores/document-store'
import { useTranslateStore } from '@/lib/stores/translate-store'
import { Loader, MinusIcon } from 'lucide-react'
import { ScrollArea } from './ui/scroll-area'
import { Fragment } from 'react/jsx-runtime'
import { Separator } from './ui/separator'
import { useEffect, useRef } from 'react'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'

export function Translator() {
  const scrollRef = useRef<HTMLDivElement>(null)

  const enableTranslate = useDocumentStore((state) => state.translate)
  const translations = useTranslateStore((state) => state.translations)
  const isTranslating = useTranslateStore((state) => state.isThinking)
  const toggleTranslate = useDocumentStore((state) => state.toggleTranslate)

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollIntoView({ behavior: 'smooth' }) //Use scrollIntoView to automatically scroll to my ref
  }, [translations])

  if (!enableTranslate) return null

  return (
    <div className="font-sans w-[400px] p-4 z-10 absolute h-[calc(100vh-var(--header-height))] top-[var(--header-height)] right-3">
      <ScrollArea className="h-full w-full border bg-white rounded-md shadow-sm">
        <div className="sticky top-0 bg-white z-10 py-2 px-4 flex items-center justify-between border-b mb-2">
          <h4 className="leading-none font-bold">Translations</h4>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => toggleTranslate()}
          >
            <MinusIcon className="size-4" />
          </Button>
        </div>

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
    </div>
  )
}
