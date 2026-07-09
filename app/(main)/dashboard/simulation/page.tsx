"use client"

import * as React from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { authClient } from "@/lib/auth-client"
import { redirect } from "next/navigation"

import { SiteHeader } from "@/components/site-header"
import { SimulationPanel } from "@/components/simulation-panel"
import { UssdSimulator } from "@/components/ussd-simulator"
import { Loader2, SlidersIcon, SettingsIcon, InfoIcon } from "lucide-react"

export default function SimulationPage() {
  const { data: session, isPending: isSessionPending } = authClient.useSession()
  const tenantData = useQuery(api.tenants.getCurrent)

  React.useEffect(() => {
    if (!isSessionPending && !session) {
      redirect("/login")
    }
  }, [session, isSessionPending])

  // Route security: only allow Platform Admin
  React.useEffect(() => {
    if (tenantData !== undefined) {
      if (!tenantData?.isPlatformAdmin) {
        redirect("/dashboard")
      }
    }
  }, [tenantData])

  if (isSessionPending || tenantData === undefined) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-muted-foreground gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm font-medium tracking-wide">Initializing control room...</span>
      </div>
    )
  }

  if (!session || !tenantData?.isPlatformAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      
      <div className="flex-1 @container/main flex flex-col gap-6 py-6 px-4 lg:px-6">
        
        {/* Header Title */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <SlidersIcon className="size-6 text-primary animate-pulse" />
            <h2 className="text-2xl font-bold tracking-tight text-foreground font-sans">
              Demo Simulation Control Room
            </h2>
          </div>
          <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
            Authorized Platform Administrator portal. Manipulate satellite weather parameters, advance the seasonal crop clock, trigger automated indemnity disbursements, and run the simulated farmer USSD handset in real-time.
          </p>
        </div>

        {/* Informative Help banner */}
        <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-xl border border-primary/10 text-xs text-primary/80 max-w-4xl">
          <InfoIcon className="size-4 shrink-0 mt-0.5" />
          <div className="space-y-1 leading-normal">
            <span className="font-bold">Pitch Guide Recommendation:</span>
            <p>
              Use this private control room to execute the live drought scenario while keeping a separate browser tab open logged in as a Tenant Insurer (e.g. Kilimo Sure) to show the judges how the database reacts instantaneously when weather boundaries are breached.
            </p>
          </div>
        </div>

        {/* Dynamic Grid Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          {/* Left Column: Timeline Control Panel */}
          <div className="xl:col-span-2 space-y-6">
            <SimulationPanel />
          </div>

          {/* Right Column: Farmer Handset Simulator */}
          <div className="xl:col-span-1 flex justify-center xl:justify-start">
            <UssdSimulator />
          </div>
        </div>

      </div>
    </div>
  )
}
