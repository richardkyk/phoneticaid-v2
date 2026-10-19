import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useState } from 'react'
import { Button } from './ui/button'
import { PencilIcon } from 'lucide-react'
import { useProjectsStore } from '@/lib/stores/projects-store'
import { useUiStore } from '@/lib/stores/ui-store'
import { PanelRightIcon } from 'lucide-react'
import { DocumentToolbar } from './toolbar'
import { cn } from '@/lib/utils'

export function AppHeader() {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>
                <EditableTitle />
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <DocumentToolbar />
        <Separator
          orientation="vertical"
          className="mx-1 data-[orientation=vertical]:h-4"
        />
        <SettingsToggle />
      </div>
    </header>
  )
}

function SettingsToggle() {
  const settingsOpen = useUiStore((state) => state.settingsOpen)
  const toggleSettings = useUiStore((state) => state.toggleSettings)

  return (
    <Button
      variant={settingsOpen ? 'secondary' : 'ghost'}
      size="icon-sm"
      onClick={toggleSettings}
      title={settingsOpen ? 'Hide settings' : 'Show settings'}
      className={cn('shadow-none')}
    >
      <PanelRightIcon />
    </Button>
  )
}

function EditableTitle() {
  const [isEditing, setIsEditing] = useState(false)

  const activeProject = useProjectsStore((state) => state.getActiveProject())
  const setActiveProjectAttribute = useProjectsStore(
    (state) => state.setActiveProjectAttribute,
  )

  return isEditing ? (
    <input
      type="text"
      autoFocus
      value={activeProject.title}
      onChange={(e) => setActiveProjectAttribute({ title: e.target.value })}
      className="border px-2 w-[180px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      onBlur={() => setIsEditing(false)}
    />
  ) : (
    <Button
      className="has-[>svg]:px-2"
      onClick={() => setIsEditing(true)}
      variant="ghost"
      size="sm"
    >
      <span>{activeProject.title}</span>
      <PencilIcon className="size-3.5" />
    </Button>
  )
}
