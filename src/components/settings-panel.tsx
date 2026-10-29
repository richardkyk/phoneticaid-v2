import { useUiStore } from '@/lib/stores/ui-store'
import type { PanelTab } from '@/lib/stores/ui-store'
import { Button } from './ui/button'
import {
  LayoutToolbar,
  ReadingToolbar,
  SpacingToolbar,
  TextToolbar,
} from './toolbar'
import { TranslationHistory } from './translation-history'

const tabs: Array<{ value: PanelTab; label: string }> = [
  { value: 'settings', label: 'Settings' },
  { value: 'translations', label: 'Translations' },
]

// Settings and translations for the active project, shown to the right of
// the canvas
export function SettingsPanel() {
  const tab = useUiStore((state) => state.panelTab)
  const setTab = useUiStore((state) => state.setPanelTab)

  return (
    <aside className="flex w-64 shrink-0 flex-col border-l bg-background print:hidden">
      <div className="flex gap-1 border-b p-2">
        {tabs.map((t) => (
          <Button
            key={t.value}
            variant={tab === t.value ? 'secondary' : 'ghost'}
            size="sm"
            className="flex-1 shadow-none"
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </Button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'settings' ? (
          <>
            <TextToolbar />
            <ReadingToolbar />
            <LayoutToolbar />
            <SpacingToolbar />
          </>
        ) : (
          <TranslationHistory />
        )}
      </div>
    </aside>
  )
}
