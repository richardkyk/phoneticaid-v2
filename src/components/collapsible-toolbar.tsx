import * as React from 'react'
import { ChevronRight } from 'lucide-react'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarSeparator,
} from '@/components/ui/sidebar'

interface CollapsibleToolbarProps {
  name: string
  icon?: React.ReactNode | undefined
  children: React.ReactNode
}
export function CollapsibleToolbar(props: CollapsibleToolbarProps) {
  return (
    <>
      <SidebarGroup key={props.name} className="py-0">
        <Collapsible className="group/collapsible" defaultOpen>
          <SidebarGroupLabel
            asChild
            className="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full text-sm"
          >
            <CollapsibleTrigger>
              <div className="flex font-normal items-center gap-2">
                {props.icon}
                {props.name}
              </div>
              <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
            </CollapsibleTrigger>
          </SidebarGroupLabel>
          <CollapsibleContent>
            <SidebarGroupContent className="p-2">
              {props.children}
            </SidebarGroupContent>
          </CollapsibleContent>
        </Collapsible>
      </SidebarGroup>
      <SidebarSeparator className="mx-0" />
    </>
  )
}
