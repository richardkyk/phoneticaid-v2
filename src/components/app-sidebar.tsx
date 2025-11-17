'use client'

import * as React from 'react'

import {
  Sidebar,
  SidebarContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import {
  DocumentToolbar,
  LayoutToolbar,
  SpacingToolbar,
  TextToolbar,
} from './toolbar.tsx'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild>
              <div>
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <img
                    src="/favicon.ico"
                    alt="PhoneticAid"
                    width={32}
                    height={32}
                  />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">PhoneticAid</span>
                </div>
              </div>
            </SidebarMenuButton>
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
        {/* <NavProjects projects={data.projects} /> */}
      </SidebarContent>
    </Sidebar>
  )
}
