import { AppHeader } from '@/components/app-header'
import { Document } from '@/components/document'
import { SettingsPanel } from '@/components/settings-panel'
import { Toaster } from '@/components/ui/sonner'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
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
        {/* on narrow screens it's a drawer from the bottom, leaving the top
        of the page in view */}
        {narrow && (
          <Drawer
            open={drawerOpen}
            onOpenChange={(open) =>
              useUiStore.getState().setSettingsDrawerOpen(open)
            }
          >
            <DrawerContent
              overlayClassName="bg-black/10"
              className="h-[60dvh] print:hidden"
              aria-describedby={undefined}
            >
              <DrawerTitle className="sr-only">Settings</DrawerTitle>
              <SettingsPanel className="min-h-0 w-full flex-1 border-l-0" />
            </DrawerContent>
          </Drawer>
        )}
      </div>
      <Toaster position="top-right" />
    </div>
  )
}
