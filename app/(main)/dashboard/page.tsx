"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { authClient } from "@/lib/auth-client"

import { ChartAreaInteractive } from "@/components/chart-area-interactive"

import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import { SiteHeader } from "@/components/site-header"
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
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-muted-foreground gap-3">
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
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-6 py-6">
              


              {/* Operational KPI cards */}
              <SectionCards />

              
              {/* Full Width Layout: Weather Chart & Policies Registry */}
              <div className="space-y-6 px-4 lg:px-6">
                <ChartAreaInteractive />
                <DataTable data={policies ?? []} />
              </div>


            </div>
          </div>
    </div>
  )
}
