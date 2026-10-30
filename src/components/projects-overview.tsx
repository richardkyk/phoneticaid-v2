import { Link, useNavigate } from '@tanstack/react-router'
import { CopyIcon, MoreHorizontal, PlusIcon, Trash2 } from 'lucide-react'
import { useProjectsStore } from '@/lib/stores/projects-store'
import type { Project } from '@/lib/stores/projects-store'
import { getText } from '@/lib/piece-table'
import { pageSize } from '@/lib/geometry'
import { Button } from './ui/button'
import { AccountMenu } from './account-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['week', 7 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
]

// e.g. "3 hours ago"
function timeAgo(time: number, now = Date.now()) {
  const elapsed = now - time
  for (const [unit, ms] of UNITS) {
    if (elapsed >= ms)
      return relativeTime.format(-Math.floor(elapsed / ms), unit)
  }
  return 'just now'
}

// px, landscape pages are about 180px wide at this height
const THUMBNAIL_HEIGHT = 128

// Every project, most recently edited first, each opening its workspace
export function ProjectsOverview() {
  const projects = useProjectsStore((state) => state.projects)
  const navigate = useNavigate()

  const newProject = () => {
    const project = useProjectsStore.getState().addProject()
    // replaced rather than added to the history, so swiping back on a phone
    // (which pans can set off) doesn't leave the project
    navigate({
      to: '/projects/$projectId',
      params: { projectId: project.id },
      replace: true,
    })
  }

  const sorted = [...projects].sort((a, b) => b.lastUpdated - a.lastUpdated)

  return (
    <div className="min-h-svh bg-muted/40">
      <header className="flex h-14 items-center gap-2 border-b bg-background px-6">
        <img src="/favicon.ico" alt="" width={24} height={24} />
        <span className="font-medium">PhoneticAid</span>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" onClick={newProject}>
            <PlusIcon />
            New project
          </Button>
          <AccountMenu />
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="mb-4 text-lg font-medium">Projects</h1>
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-background p-12 text-sm text-muted-foreground">
            No projects yet
            <Button size="sm" onClick={newProject}>
              <PlusIcon />
              New project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-4">
            {sorted.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function ProjectCard({ project }: { project: Project }) {
  const page = pageSize(project.doc)
  const text = getText(project.pt, 0, 200)

  return (
    <div className="group relative overflow-hidden rounded-lg border bg-background transition-shadow hover:shadow-md">
      <Link
        to="/projects/$projectId"
        params={{ projectId: project.id }}
        replace
        className="block"
      >
        {/* a thumbnail of the first page */}
        <div className="flex items-center justify-center bg-muted/60 py-4">
          {/* the same height for every page, so the cards line up */}
          <div
            className="overflow-hidden bg-white p-2 font-chinese text-[8px] leading-relaxed text-gray-600 shadow-sm whitespace-pre-wrap break-all"
            style={{
              height: THUMBNAIL_HEIGHT,
              width: (THUMBNAIL_HEIGHT * page.width) / page.height,
            }}
          >
            {text}
          </div>
        </div>
        <div className="border-t px-3 py-2 pr-10">
          <div className="truncate text-sm font-medium">{project.title}</div>
          <div className="text-xs text-muted-foreground">
            Edited {timeAgo(project.lastUpdated)}
          </div>
        </div>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute right-2 bottom-2.5"
            title="More"
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            onClick={() =>
              useProjectsStore.getState().duplicateProject(project.id)
            }
          >
            <CopyIcon className="text-muted-foreground" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              if (window.confirm(`Delete "${project.title}"?`)) {
                useProjectsStore.getState().deleteProject(project.id)
              }
            }}
          >
            <Trash2 className="text-muted-foreground" />
            Delete project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
