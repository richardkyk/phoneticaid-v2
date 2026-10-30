import { AppHeader } from '@/components/app-header'
import { Document } from '@/components/document'
import { SettingsPanel } from '@/components/settings-panel'
import { Toaster } from '@/components/ui/sonner'
import { useProjectsStore } from '@/lib/stores/projects-store'
import { useUiStore } from '@/lib/stores/ui-store'
import { createFileRoute, redirect } from '@tanstack/react-router'

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
  const settingsOpen = useUiStore((state) => state.settingsOpen)

  return (
    // fixed to the viewport so the canvas scrolls rather than the page, and
    // the page has nothing to scroll (iOS scrolls it to show a focused input)
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      <AppHeader />
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <Document />
        </div>
        {settingsOpen && <SettingsPanel />}
      </div>
      <Toaster position="top-right" />
    </div>
  )
}
