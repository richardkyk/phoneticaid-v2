import { AppHeader } from '@/components/app-header'
import { Document } from '@/components/document'
import { SettingsPanel } from '@/components/settings-panel'
import { Toaster } from '@/components/ui/sonner'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { useProjectsStore } from '@/lib/stores/projects-store'
import { useUiStore } from '@/lib/stores/ui-store'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useIsMobile } from '@/hooks/use-mobile'
import { useEffect } from 'react'

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
  // the drawer's only on narrow screens, and taps on the pages only close it
  // while it's open
  useEffect(() => {
    if (!narrow) useUiStore.getState().setSettingsDrawerOpen(false)
  }, [narrow])
  // a pinch zooms the pages (see canvas.tsx), anywhere else (e.g. on the
  // drawer) it would zoom the whole app in Safari
  useEffect(() => {
    const preventZoom = (e: Event) => e.preventDefault()
    document.addEventListener('gesturestart', preventZoom)
    document.addEventListener('gesturechange', preventZoom)
    return () => {
      document.removeEventListener('gesturestart', preventZoom)
      document.removeEventListener('gesturechange', preventZoom)
    }
  }, [])

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
        of the page in view. The pages can still be panned and zoomed under
        it, and tapping them closes it (see editor.tsx) */}
        {narrow && (
          <Drawer
            // vaul is patched to pass this on to Radix, which otherwise
            // blocks touches outside the drawer (patches/vaul.patch)
            modal={false}
            // the page is already fixed, so its body needn't be on Safari
            noBodyStyles
            open={drawerOpen}
            onOpenChange={(open) =>
              useUiStore.getState().setSettingsDrawerOpen(open)
            }
          >
            <DrawerContent
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
