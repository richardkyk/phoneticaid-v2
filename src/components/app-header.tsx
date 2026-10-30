import { Link, useNavigate } from '@tanstack/react-router'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { useState } from 'react'
import { Button } from './ui/button'
import { PencilIcon } from 'lucide-react'
import { useProjectsStore } from '@/lib/stores/projects-store'
import { useUiStore } from '@/lib/stores/ui-store'
import {
  CheckIcon,
  ChevronsUpDownIcon,
  LayoutGridIcon,
  PanelRightIcon,
  PlusIcon,
} from 'lucide-react'
import { DocumentToolbar } from './toolbar'
import { AccountMenu } from './account-menu'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'

export function AppHeader() {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      {/* the title gives way on narrow screens */}
      <div className="flex min-w-0 items-center gap-1">
        <Button variant="ghost" size="icon-sm" asChild title="All projects">
          <Link to="/" replace>
            <img src="/favicon.ico" alt="All projects" width={20} height={20} />
          </Link>
        </Button>
        <Separator
          orientation="vertical"
          className="mx-1 data-[orientation=vertical]:h-4"
        />
        <EditableTitle />
        <ProjectSwitcher />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <DocumentToolbar />
        <Separator
          orientation="vertical"
          className="mx-1 data-[orientation=vertical]:h-4"
        />
        <SettingsToggle />
        <AccountMenu />
      </div>
    </header>
  )
}

// projects listed in the switcher
const RECENT_PROJECTS = 8

// Jumps to another project without going back to the overview
function ProjectSwitcher() {
  const projects = useProjectsStore((state) => state.projects)
  const activeId = useProjectsStore((state) => state.activeId)
  const navigate = useNavigate()

  const recent = [...projects]
    .sort((a, b) => b.lastUpdated - a.lastUpdated)
    .slice(0, RECENT_PROJECTS)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" title="Switch project">
          <ChevronsUpDownIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Recent projects
        </DropdownMenuLabel>
        {recent.map((project) => (
          <DropdownMenuItem key={project.id} asChild>
            <Link
              to="/projects/$projectId"
              params={{ projectId: project.id }}
              replace
            >
              <span className="truncate">{project.title}</span>
              {project.id === activeId && (
                <CheckIcon className="ml-auto size-4" />
              )}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            const project = useProjectsStore.getState().addProject()
            navigate({
              to: '/projects/$projectId',
              params: { projectId: project.id },
              replace: true,
            })
          }}
        >
          <PlusIcon />
          New project
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/" replace>
            <LayoutGridIcon />
            All projects
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SettingsToggle() {
  const narrow = useIsMobile()
  const open = useUiStore((state) =>
    narrow ? state.settingsDrawerOpen : state.settingsOpen,
  )
  const toggle = () => {
    const ui = useUiStore.getState()
    if (narrow) ui.setSettingsDrawerOpen(!ui.settingsDrawerOpen)
    else ui.toggleSettings()
  }

  return (
    <Button
      variant={open ? 'secondary' : 'ghost'}
      size="icon-sm"
      onClick={toggle}
      title={open ? 'Hide settings' : 'Show settings'}
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
      className="min-w-0 shrink has-[>svg]:px-2"
      onClick={() => setIsEditing(true)}
      variant="ghost"
      size="sm"
    >
      <span className="truncate">{activeProject.title}</span>
      <PencilIcon className="size-3.5" />
    </Button>
  )
}
