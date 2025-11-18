'use client'

import { FileIcon, MoreHorizontal, PlusIcon, Trash2 } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { useProjectsStore } from '@/lib/stores/projects-store'

export function NavProjects() {
  const { isMobile } = useSidebar()

  const projects = useProjectsStore((state) => state.projects)
  const activeId = useProjectsStore((state) => state.activeId)

  const addProject = useProjectsStore((state) => state.addProject)
  const setActiveProject = useProjectsStore((state) => state.setActiveProject)
  const deleteProject = useProjectsStore((state) => state.deleteProject)

  const sortedProjects = projects.sort((a, b) => b.lastUpdated - a.lastUpdated)

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Projects</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton onClick={() => addProject()}>
            <PlusIcon />
            <span>Add</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        {sortedProjects.map((item) => (
          <SidebarMenuItem key={item.id}>
            <SidebarMenuButton
              isActive={item.id === activeId}
              onClick={() => setActiveProject(item.id)}
              asChild
            >
              <div className="select-none">
                <FileIcon />
                <span>{item.title}</span>
              </div>
            </SidebarMenuButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction showOnHover>
                  <MoreHorizontal />
                  <span className="sr-only">More</span>
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-36"
                side={isMobile ? 'bottom' : 'right'}
                align={isMobile ? 'end' : 'start'}
              >
                <DropdownMenuItem onClick={() => deleteProject(item.id)}>
                  <Trash2 className="text-muted-foreground" />
                  <span>Delete Project</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
