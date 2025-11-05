import { useDocumentStore } from '@/lib/stores/document-store'
import { useTranslateStore } from '@/lib/stores/translate-store'
import { Loader } from 'lucide-react'
import { ScrollArea } from './ui/scroll-area'
import { Fragment } from 'react/jsx-runtime'
import { Separator } from './ui/separator'
import { useEffect, useRef } from 'react'

export function Translator() {
  const scrollRef = useRef<HTMLDivElement>(null)

  const enableTranslate = useDocumentStore((state) => state.translate)
  const translations = useTranslateStore((state) => state.translations)
  const isTranslating = useTranslateStore((state) => state.isThinking)

  useEffect(() => {
    if (translations) {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' }) //Use scrollIntoView to automatically scroll to my ref
    }
  }, [translations])

  if (!enableTranslate) return null

  return (
    <div className="font-sans w-[350px] bg-white flex flex-col z-10 absolute h-[calc(100vh-var(--header-height))] top-[var(--header-height)] right-3 border-l">
      <ScrollArea className="h-full w-full">
        <div className="p-4">
          <h4 className="mb-4 leading-none font-bold">Translations</h4>

          {translations.length === 0 && (
            <div className="italic">Highlight text to translate</div>
          )}
          {translations.map((t, idx) => (
            <Fragment key={idx + t.original}>
              <Separator className="my-2" />
              <div className="whitespace-pre-line mb-1 text-muted-foreground">
                {t.original}
              </div>
              <div className="relative whitespace-pre-line">
                {t.translation}
                {isTranslating && idx === translations.length - 1 && (
                  <Loader className="size-4 mt-2 animate-spin" />
                )}
              </div>
            </Fragment>
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>
    </div>
  )
}
