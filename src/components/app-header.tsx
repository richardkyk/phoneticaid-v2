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

export function AppHeader() {
  return (
    <header className="flex h-10 shrink-0 items-center gap-2">
      <div className="flex items-center gap-2 px-4">
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
    </header>
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
