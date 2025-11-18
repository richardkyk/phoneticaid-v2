'use client'

import * as React from 'react'

import {
  Sidebar,
  SidebarContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import {
  DocumentToolbar,
  LayoutToolbar,
  SpacingToolbar,
  TextToolbar,
} from './toolbar.tsx'
import { NavProjects } from './nav-projects.tsx'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2">
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <img
                  src="/favicon.ico"
                  alt="PhoneticAid"
                  width={32}
                  height={32}
                />
              </div>
              <div className="text-sm leading-tight">
                <span className="truncate font-medium">PhoneticAid</span>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroupLabel>Config</SidebarGroupLabel>
        <DocumentToolbar />
        <SidebarSeparator className="mx-0" />
        <TextToolbar />
        <LayoutToolbar />
        <SpacingToolbar />
        <NavProjects />
      </SidebarContent>
    </Sidebar>
  )
}
