import { AppHeader } from '@/components/app-header'
import { AppSidebar } from '@/components/app-sidebar'
import { Document } from '@/components/document'
import { Translator } from '@/components/translator'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: App,
  ssr: false,
})

function App() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <div className="flex flex-1 flex-col">
          <Translator />
          <Document />
          <Toaster position="top-right" />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
