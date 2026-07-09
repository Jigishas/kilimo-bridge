"use client"

import * as React from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { authClient } from "@/lib/auth-client"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { 
  LayoutDashboardIcon, 
  Settings2Icon, 
  CircleHelpIcon, 
  SearchIcon, 
  DatabaseIcon, 
  FileChartColumnIcon, 
  FileIcon, 
  ShieldCheckIcon 
} from "lucide-react"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = authClient.useSession()
  const tenantData = useQuery(api.tenants.getCurrent)

  const tenantName = tenantData?.tenant?.name ?? "Mvua Shield"

  const userData = {
    name: session?.user?.name ?? "Loading...",
    email: session?.user?.email ?? "...",
    avatar: session?.user?.image || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&h=256&auto=format&fit=crop",
  }

  const navMain = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: <LayoutDashboardIcon />,
    }
  ]

  const documents = [
    {
      name: "Data Library",
      url: "#",
      icon: <DatabaseIcon />,
    },
    {
      name: "Underwriting Reports",
      url: "#",
      icon: <FileChartColumnIcon />,
    },
    {
      name: "USSD Script Guide",
      url: "#",
      icon: <FileIcon />,
    },
  ]

  const navSecondary = [
    {
      title: "Insurer Settings",
      url: "#",
      icon: <Settings2Icon />,
    },
    {
      title: "Get Help",
      url: "#",
      icon: <CircleHelpIcon />,
    },
    {
      title: "Audit Search",
      url: "#",
      icon: <SearchIcon />,
    },
  ]

  return (
    <Sidebar collapsible="offcanvas" {...props} className="border-r border-border bg-card">
      <SidebarHeader className="border-b border-border py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5! hover:bg-transparent"
              render={<div />}
            >
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ShieldCheckIcon className="size-4" />
              </div>
              <span className="text-base font-bold text-foreground tracking-wide">{tenantName}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      
      <SidebarContent>
        <NavMain items={navMain} />
        <NavDocuments items={documents} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      
      <SidebarFooter className="border-t border-border py-2">
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  )
}
