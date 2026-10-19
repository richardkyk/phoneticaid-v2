import { AppHeader } from '@/components/app-header'
import { AppSidebar } from '@/components/app-sidebar'
import { Document } from '@/components/document'
import { SettingsPanel } from '@/components/settings-panel'
import { Translator } from '@/components/translator'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { useUiStore } from '@/lib/stores/ui-store'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: App,
  ssr: false,
})

function App() {
  const settingsOpen = useUiStore((state) => state.settingsOpen)

  return (
    <SidebarProvider>
      <AppSidebar />
      {/* fixed height so the canvas scrolls rather than the page */}
      <SidebarInset className="h-svh overflow-hidden md:peer-data-[variant=inset]:h-[calc(100svh-1rem)]">
        <AppHeader />
        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1">
            <Document />
          </div>
          {settingsOpen && <SettingsPanel />}
        </div>
        <Translator />
        <Toaster position="top-right" />
      </SidebarInset>
    </SidebarProvider>
  )
}
