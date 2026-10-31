import { useUiStore } from '@/lib/stores/ui-store'
import type { PanelTab } from '@/lib/stores/ui-store'
import { XIcon } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'
import {
  DocumentToolbar,
  LayoutToolbar,
  PinyinToolbar,
  SpacingToolbar,
  TextToolbar,
} from './toolbar'
import { TranslationHistory, TranslationSettings } from './translation-history'

const tabs: Array<{ value: PanelTab; label: string }> = [
  { value: 'settings', label: 'Settings' },
  { value: 'translations', label: 'Translations' },
]

interface SettingsPanelProps {
  className?: string
  // shown in a drawer that can be closed (on narrow screens)
  onClose?: () => void
}
// Settings and translations for the active project, shown to the right of
// the canvas, or in a drawer from the bottom on narrow screens
export function SettingsPanel(props: SettingsPanelProps) {
  const tab = useUiStore((state) => state.panelTab)
  const setTab = useUiStore((state) => state.setPanelTab)

  return (
    <aside
      className={cn(
        'flex w-64 shrink-0 flex-col border-l bg-background print:hidden',
        props.className,
      )}
    >
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
        {props.onClose && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="shadow-none"
            title="Close settings"
            onClick={props.onClose}
          >
            <XIcon />
          </Button>
        )}
      </div>
      <DocumentToolbar />
      {tab === 'settings' ? (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <TextToolbar />
          <PinyinToolbar />
          <LayoutToolbar />
          <SpacingToolbar />
        </div>
      ) : (
        // only the history scrolls, under the translation settings
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0">
            <TranslationSettings />
          </div>
          <TranslationHistory />
        </div>
      )}
    </aside>
  )
}
