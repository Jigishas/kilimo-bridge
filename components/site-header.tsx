"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useTheme } from "next-themes"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { ShieldCheckIcon, SunIcon, MoonIcon } from "lucide-react"
import { useEffect, useState } from "react"

export function SiteHeader() {
  const tenantData = useQuery(api.tenants.getCurrent)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  let title = "Secure Insurance Console"
  if (tenantData) {
    if (tenantData.isPlatformAdmin) {
      title = "Mvua Shield — Platform Administration"
    } else if (tenantData.tenant) {
      title = `${tenantData.tenant.name} — Underwriting Console`
    }
  }

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b border-border bg-card transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 bg-border"
        />
        <div className="flex items-center gap-2 flex-1">
          {tenantData?.isPlatformAdmin && <ShieldCheckIcon className="size-4 text-primary animate-pulse" />}
          <h1 className="text-sm font-semibold tracking-wide text-foreground uppercase">
            {title}
          </h1>
        </div>
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <SunIcon className="size-4" />
            ) : (
              <MoonIcon className="size-4" />
            )}
          </Button>
        )}
      </div>
    </header>
  )
}
