import { useDocumentStore } from '@/lib/stores/document-store'
import { useTranslateStore } from '@/lib/stores/translate-store'
import { Loader } from 'lucide-react'

export function Translator() {
  const enableTranslate = useDocumentStore((state) => state.translate)
  const translations = useTranslateStore((state) => state.translations)
  const isTranslating = useTranslateStore((state) => state.isThinking)

  if (!enableTranslate) return null

  return (
    <div className="p-4 font-sans w-[350px] bg-white z-10 absolute h-[calc(100vh-var(--header-height))] top-[var(--header-height)] right-4 border-l">
      <div className="font-bold">Translations</div>
      {translations.length === 0 && (
        <div className="pt-3 italic">Highlight text to translate</div>
      )}
      <div className="space-y-3 pt-3">
        {translations.map((t, idx) => (
          <div key={idx + t.original}>
            <div>{t.original}</div>
            <div className="relative">
              {t.translation}
              {isTranslating && idx === translations.length - 1 && (
                <div className="top-1 absolute left-0">
                  <Loader className="size-4 animate-spin" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
