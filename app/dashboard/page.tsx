"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { authClient } from "@/lib/auth-client"

import { AppSidebar } from "@/components/app-sidebar"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import { SiteHeader } from "@/components/site-header"
import { SimulationPanel } from "@/components/simulation-panel"
import { UssdSimulator } from "@/components/ussd-simulator"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Loader2 } from "lucide-react"

export default function Page() {
  const router = useRouter()
  const { data: session, isPending: isSessionPending } = authClient.useSession()
  const tenantData = useQuery(api.tenants.getCurrent)
  const policies = useQuery(api.policies.list)

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (!isSessionPending && !session) {
      router.replace("/login")
    }
  }, [session, isSessionPending, router])

  if (isSessionPending || tenantData === undefined) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm font-medium tracking-wide">Loading secure dashboard...</span>
      </div>
    )
  }

  if (!session) {
    return null // Will redirect in useEffect
  }

  const { tenant, isPlatformAdmin } = tenantData ?? { tenant: null, isPlatformAdmin: false }

  // Inject brand colors dynamically if available (e.g., Kilimo Sure = Green, Mavuno = Orange)
  const brandStyles = tenant?.brandConfig?.primaryColor
    ? ({
        "--primary": tenant.brandConfig.primaryColor,
      } as React.CSSProperties)
    : {}

  return (
    <div style={brandStyles} className="min-h-screen bg-background">
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-6 py-6">
              
              {/* Operational KPI cards */}
              <SectionCards />
              
              {/* Dynamic Grid Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4 lg:px-6">
                
                {/* Left/Main Column: Rainfall Chart & Policy Table */}
                <div className="lg:col-span-2 space-y-6 flex flex-col">
                  <ChartAreaInteractive />
                  
                  <div className="flex-1">
                    <DataTable data={policies ?? []} />
                  </div>
                </div>

                {/* Right/Demonstrator Column: Simulation Panel & USSD Phone Widget */}
                <div className="lg:col-span-1 space-y-6">
                  {/* Platform administrators and demonstrators get the controls */}
                  <SimulationPanel />
                  <UssdSimulator />
                </div>

              </div>

            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
