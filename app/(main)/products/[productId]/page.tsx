"use client"

import * as React from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { authClient } from "@/lib/auth-client"
import { redirect } from "next/navigation"

import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, SproutIcon, MapPinIcon, ShieldCheckIcon, ShieldAlertIcon, LandPlotIcon, LandmarkIcon, ChevronLeftIcon } from "lucide-react"
import Link from "next/link"

export default function ProductStatsPage(props: { params: Promise<{ productId: string }> }) {
  const params = React.use(props.params)
  const { data: session, isPending: isSessionPending } = authClient.useSession()
  const tenantData = useQuery(api.tenants.getCurrent)
  const product = useQuery(api.products.get, { id: params.productId as any })
  const policies = useQuery(api.policies.list)

  React.useEffect(() => {
    if (!isSessionPending && !session) {
      redirect("/login")
    }
  }, [session, isSessionPending])

  if (isSessionPending || tenantData === undefined || product === undefined || policies === undefined) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm font-medium tracking-wide">Loading scheme statistics...</span>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-zinc-400 gap-3 p-6 text-center">
        <h2 className="text-lg font-bold text-foreground">Scheme not found</h2>
        <p className="text-xs text-muted-foreground">The requested product scheme tariff does not exist.</p>
        <Link href="/dashboard" className="text-xs underline text-primary">Return to dashboard</Link>
      </div>
    )
  }

  const { tenant } = tenantData ?? { tenant: null }

  // Filter policies for this specific product
  const productPolicies = policies?.filter((p) => p.productId === product._id) ?? []
  
  // Calculate specific product statistics
  const activeCount = productPolicies.filter((p) => p.status === "ACTIVE").length
  const paidCount = productPolicies.filter((p) => p.status === "PAID_OUT").length
  const totalPremium = productPolicies.reduce((acc, p) => acc + p.premiumPaid, 0)
  const totalExposure = productPolicies.reduce((acc, p) => acc + p.sumInsured, 0)
  const totalPayouts = productPolicies.filter((p) => p.status === "PAID_OUT").reduce((acc, p) => acc + p.sumInsured, 0)

  // Inject brand colors dynamically if available (e.g., Kilimo Sure = Green, Mavuno = Orange)
  const brandStyles = tenant?.brandConfig?.primaryColor
    ? ({
        "--primary": tenant.brandConfig.primaryColor,
      } as React.CSSProperties)
    : {}

  return (
    <div style={brandStyles} className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      
      <div className="flex-1 @container/main flex flex-col gap-6 py-6 px-4 lg:px-6">
        
        {/* Header Back Button & Metadata */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <Link href="/dashboard" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1 font-medium">
              <ChevronLeftIcon className="size-3.5" />
              Back to dashboard
            </Link>
            <div className="flex items-center gap-2">
              <SproutIcon className="size-6 text-primary" />
              <h2 className="text-2xl font-bold tracking-tight text-foreground">{product.name}</h2>
            </div>
            <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted-foreground font-mono">
              <span className="flex items-center gap-1">
                <MapPinIcon className="size-3.5" />
                {product.county} County
              </span>
              <span>•</span>
              <span className="capitalize">{product.cropType} Cover</span>
              <span>•</span>
              <span>Premium Rate: KES {product.premiumPerAcre.toLocaleString()}/Acre</span>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <Badge variant="outline" className="border-emerald-500/20 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-400 py-1 px-3 text-xs uppercase font-bold tracking-wider">
              Active Tariff
            </Badge>
          </div>
        </div>

        {/* Operational Product KPI Cards */}
        <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
          {/* 1. Policies Onboarded */}
          <Card className="@container/card">
            <CardHeader>
              <CardDescription>Onboarded Policies</CardDescription>
              <CardTitle className="text-xl font-semibold tabular-nums text-foreground">
                {productPolicies.length} Total
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="text-[10px] py-0.5 border-emerald-500/20 text-emerald-500 bg-emerald-500/10">
                  {activeCount} Active Cover
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Total policies written under this scheme.
            </CardContent>
          </Card>

          {/* 2. Premium Pool */}
          <Card className="@container/card">
            <CardHeader>
              <CardDescription>Premium Underwritten</CardDescription>
              <CardTitle className="text-xl font-semibold tabular-nums text-foreground">
                KES {totalPremium.toLocaleString()}
              </CardTitle>
              <CardAction>
                <Badge variant="outline">
                  <LandmarkIcon className="size-3 mr-1" />
                  Pool Size
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Total premiums underwritten for this county.
            </CardContent>
          </Card>

          {/* 3. Liability Exposure */}
          <Card className="@container/card">
            <CardHeader>
              <CardDescription>Total Sum Insured</CardDescription>
              <CardTitle className="text-xl font-semibold tabular-nums text-foreground">
                KES {totalExposure.toLocaleString()}
              </CardTitle>
              <CardAction>
                <Badge variant="outline">
                  <LandPlotIcon className="size-3 mr-1" />
                  Exposure
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Total potential payouts underwritten.
            </CardContent>
          </Card>

          {/* 4. Disbursed Payouts */}
          <Card className="@container/card">
            <CardHeader>
              <CardDescription>Payouts Disbursed</CardDescription>
              <CardTitle className="text-xl font-semibold tabular-nums text-foreground">
                KES {totalPayouts.toLocaleString()}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className={totalPayouts > 0 ? "border-amber-500/20 text-amber-500 bg-amber-500/10" : ""}>
                  <ShieldAlertIcon className="size-3 mr-1" />
                  {paidCount} Claims Paid
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Automated rainfall index triggered payouts.
            </CardContent>
          </Card>
        </div>

        {/* rainfall index chart & policy table */}
        <div className="grid grid-cols-1 gap-6">
          <ChartAreaInteractive county={product.county} />
          
          <div>
            <div className="mb-4">
              <h3 className="text-base font-bold text-foreground">Underwritten Policies</h3>
              <p className="text-xs text-muted-foreground">Detailed audit roster of farmers insured under this tariff scheme.</p>
            </div>
            <DataTable data={productPolicies} />
          </div>
        </div>

      </div>
    </div>
  )
}
