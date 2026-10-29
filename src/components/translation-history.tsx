import { useEffect } from 'react'
import { ChevronDownIcon, Loader, Trash2Icon } from 'lucide-react'
import { useTranslateStore } from '@/lib/stores/translate-store'
import type { Translation } from '@/lib/stores/translate-store'
import { useProjectsStore } from '@/lib/stores/projects-store'
import { useDocumentStore } from '@/lib/stores/document-store'
import { getText } from '@/lib/piece-table'
import { toDisplayScript } from '@/lib/script'
import { providerLabel, providers } from '@/lib/translate/providers'
import type { ProviderChoice } from '@/lib/translate/providers'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

const NO_TRANSLATIONS: Array<Translation> = []

// The active project's translations, newest first. Clicking one selects its
// text again, if it's still there.
export function TranslationHistory() {
  const projectId = useProjectsStore((state) => state.activeId)
  const pt = useProjectsStore((state) => state.getActiveProject().pt)
  const script = useDocumentStore((state) => state.script)
  const translations = useTranslateStore(
    (state) => state.history[projectId] ?? NO_TRANSLATIONS,
  )
  const pending = useTranslateStore((state) => state.pending)
  const current = useTranslateStore((state) => state.current)
  const text = getText(pt)

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 border-b p-2">
        <ProviderSelect />
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          title="Clear history"
          disabled={translations.length === 0}
          onClick={() => useTranslateStore.getState().clearHistory()}
        >
          <Trash2Icon className="size-4" />
        </Button>
      </div>
      {translations.length === 0 && (
        <p className="p-4 text-xs text-muted-foreground">
          Select text to translate it. Translations show up here.
        </p>
      )}
      {[...translations].reverse().map((t) => {
        // the text has been edited since
        const stale = text.slice(t.start, t.end) !== t.original
        return (
          <button
            key={t.id}
            disabled={stale}
            title={stale ? 'The text has changed since' : 'Select this text'}
            onClick={() => useTranslateStore.getState().showTranslation(t.id)}
            className={cn(
              'flex flex-col gap-0.5 border-b px-4 py-2 text-left text-sm hover:bg-accent disabled:hover:bg-transparent',
              t.id === current && 'bg-accent/60',
            )}
          >
            <span className="font-chinese text-muted-foreground line-clamp-2">
              {toDisplayScript(t.original, script)}
            </span>
            <span className="line-clamp-3">
              {pending.includes(t.id) && (
                <Loader className="size-4 animate-spin" />
              )}
              {t.translation}
              {t.error && (
                <span className="text-destructive">
                  Translation failed: {t.error}
                </span>
              )}
            </span>
            {t.provider && (
              <span className="text-xs text-muted-foreground">
                via {providerLabel(t.provider)}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function ProviderSelect() {
  const provider = useTranslateStore((state) => state.provider)
  const setProvider = useTranslateStore((state) => state.setProvider)
  const available = useTranslateStore((state) => state.availableProviders)
  const loadAvailableProviders = useTranslateStore(
    (state) => state.loadAvailableProviders,
  )

  useEffect(() => {
    loadAvailableProviders()
  }, [loadAvailableProviders])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs">
          {provider === 'auto' ? 'Auto' : providerLabel(provider)}
          <ChevronDownIcon className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Translation provider
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={provider}
          onValueChange={(v) => setProvider(v as ProviderChoice)}
        >
          <DropdownMenuRadioItem value="auto">
            Auto
            <span className="ml-auto text-xs text-muted-foreground">
              first available
            </span>
          </DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          {providers.map((p) => {
            const configured = available?.includes(p.id) ?? true
            return (
              <DropdownMenuRadioItem
                key={p.id}
                value={p.id}
                disabled={!configured}
              >
                {p.label}
                {!configured && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    not configured
                  </span>
                )}
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
