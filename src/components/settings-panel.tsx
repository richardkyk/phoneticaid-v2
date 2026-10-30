import { useUiStore } from '@/lib/stores/ui-store'
import type { PanelTab } from '@/lib/stores/ui-store'
import { useRef } from 'react'
import { XIcon } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'
import { AccountMenu } from './account-menu'
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

// how far the handle is swiped down to close the sheet, in px
const SWIPE_TO_CLOSE = 50

interface SettingsPanelProps {
  className?: string
  // shown as a sheet that can be closed (on narrow screens)
  onClose?: () => void
}
// Settings and translations for the active project, shown to the right of
// the canvas, or as a sheet from the bottom on narrow screens
export function SettingsPanel(props: SettingsPanelProps) {
  const swipeRef = useRef<number | null>(null)
  const tab = useUiStore((state) => state.panelTab)
  const setTab = useUiStore((state) => state.setPanelTab)

  return (
    <aside
      className={cn(
        'flex w-64 shrink-0 flex-col border-l bg-background print:hidden',
        props.className,
      )}
    >
      {props.onClose && (
        // a handle to swipe the sheet away
        <div
          className="flex shrink-0 touch-none justify-center pt-2 pb-1"
          onPointerDown={(e) => (swipeRef.current = e.clientY)}
          onPointerUp={(e) => {
            const start = swipeRef.current
            swipeRef.current = null
            if (start !== null && e.clientY - start > SWIPE_TO_CLOSE) {
              props.onClose?.()
            }
          }}
        >
          <div className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
        </div>
      )}
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
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {tab === 'settings' ? (
          <>
            <TextToolbar />
            <PinyinToolbar />
            <LayoutToolbar />
            <SpacingToolbar />
          </>
        ) : (
          <>
            <TranslationSettings />
            <TranslationHistory />
          </>
        )}
      </div>
      <div className="shrink-0 border-t p-2">
        <AccountMenu full />
      </div>
    </aside>
  )
}
