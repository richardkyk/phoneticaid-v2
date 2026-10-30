import { AppHeader } from '@/components/app-header'
import { Document } from '@/components/document'
import { SettingsPanel } from '@/components/settings-panel'
import { Toaster } from '@/components/ui/sonner'
import { useProjectsStore } from '@/lib/stores/projects-store'
import { useUiStore } from '@/lib/stores/ui-store'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useIsMobile } from '@/hooks/use-mobile'

// A project's workspace
export const Route = createFileRoute('/projects/$projectId')({
  component: Workspace,
  // projects are stored in the browser
  ssr: false,
  beforeLoad: ({ params }) => {
    const store = useProjectsStore.getState()
    if (!store.projects.some((p) => p.id === params.projectId)) {
      throw redirect({ to: '/' })
    }
    store.setActiveProject(params.projectId)
  },
})

function Workspace() {
  const narrow = useIsMobile()
  const settingsOpen = useUiStore((state) => state.settingsOpen)
  const drawerOpen = useUiStore((state) => state.settingsDrawerOpen)
  const closeDrawer = () => useUiStore.getState().setSettingsDrawerOpen(false)

  return (
    // fixed to the viewport so the canvas scrolls rather than the page, and
    // the page has nothing to scroll (iOS scrolls it to show a focused input)
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      <AppHeader />
      <div className="relative flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <Document />
        </div>
        {!narrow && settingsOpen && <SettingsPanel />}
        {/* on narrow screens it's a sheet from the bottom, leaving the top of
        the page in view */}
        {narrow && drawerOpen && (
          <>
            <div
              className="absolute inset-0 z-20 bg-black/10 print:hidden"
              onClick={closeDrawer}
            />
            <SettingsPanel
              onClose={closeDrawer}
              className="absolute inset-x-0 bottom-0 z-30 h-[60%] w-full animate-in slide-in-from-bottom duration-200 rounded-t-2xl border-t border-l-0 shadow-[0_-8px_24px_rgba(0,0,0,0.12)]"
            />
          </>
        )}
      </div>
      <Toaster position="top-right" />
    </div>
  )
}
