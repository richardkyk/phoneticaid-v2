import {
  LayoutToolbar,
  ReadingToolbar,
  SpacingToolbar,
  TextToolbar,
} from './toolbar'

// Settings for the active project, shown to the right of the canvas
export function SettingsPanel() {
  return (
    <aside className="w-64 shrink-0 overflow-y-auto border-l bg-background print:hidden">
      <TextToolbar />
      <ReadingToolbar />
      <LayoutToolbar />
      <SpacingToolbar />
    </aside>
  )
}
