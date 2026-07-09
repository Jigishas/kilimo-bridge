"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ShieldCheckIcon, ShieldAlertIcon, LandPlotIcon, LandmarkIcon } from "lucide-react"

export function SectionCards() {
  const stats = useQuery(api.policies.getStats)

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      
      {/* 1. Active Policies */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Active Policies</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-foreground">
            {stats !== undefined ? stats.activeCount : "..."}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="flex gap-1 items-center border-emerald-500/20 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 dark:text-emerald-400">
              <ShieldCheckIcon className="size-3" />
              Live Cover
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            Insured smallholder farmers actively covered
          </div>
        </CardFooter>
      </Card>

      {/* 2. Premium Collected */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Premium Collected</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-foreground">
            KES {stats !== undefined ? stats.activePremium.toLocaleString() : "..."}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="flex gap-1 items-center">
              <LandmarkIcon className="size-3 text-muted-foreground" />
              Collected
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            Total premiums paid via M-Pesa STK push
          </div>
        </CardFooter>
      </Card>

      {/* 3. Total Liability Exposure */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Liability Exposure</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-foreground">
            KES {stats !== undefined ? stats.totalExposure.toLocaleString() : "..."}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="flex gap-1 items-center">
              <LandPlotIcon className="size-3 text-muted-foreground" />
              Sum Insured
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            Total sum insured liabilities underwritten
          </div>
        </CardFooter>
      </Card>

      {/* 4. Automated Payouts */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Automated Payouts</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-foreground">
            KES {stats !== undefined ? stats.totalPayouts.toLocaleString() : "..."}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className={`flex gap-1 items-center ${stats !== undefined && stats.totalPayouts > 0 ? "border-amber-500/20 text-amber-600 bg-amber-50/50 dark:bg-amber-950/20 dark:text-amber-400" : ""}`}>
              <ShieldAlertIcon className="size-3" />
              Disbursed
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            Rainfall index triggered payouts
          </div>
        </CardFooter>
      </Card>

    </div>
  )
}
