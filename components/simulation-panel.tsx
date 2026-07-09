"use client"

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  PlayIcon, 
  RotateCcwIcon, 
  CloudSunIcon, 
  InfoIcon,
  ShieldCheckIcon,
  MessageSquareIcon,
  FlameIcon
} from "lucide-react"

export function SimulationPanel() {
  const simState = useQuery(api.simulation.getState)
  const advanceDayMutation = useMutation(api.simulation.advanceDay)
  const resetMutation = useMutation(api.simulation.reset)

  const [isLoading, setIsLoading] = useState(false)
  const [logs, setLogs] = useState<string[]>([
    "System seeded at Day 18.",
    "Germination threshold check scheduled for Day 21 (Needs >= 15mm rainfall)."
  ])

  const currentDay = simState?.dayIndex ?? 18
  const scenarioName = simState?.scenarioName ?? "Kitui Drought 2026"

  const handleAdvanceDay = async () => {
    setIsLoading(true)
    const newDay = currentDay + 1
    try {
      // Run the day advancement and parametric audit checks
      const result = await advanceDayMutation()
      
      const newLog = `Advanced to Day ${newDay}. Observed Kitui Cumulative Rainfall: ${result.cumulativeMm}mm.`
      setLogs((prev) => [newLog, ...prev])

      if (result.payoutsCreated && result.payoutsCreated > 0) {
        setLogs((prev) => [
          `🔥 DROUGHT TRIGGERED PAYOUTS! Disbursed payouts across ${result.payoutsCreated} active policies!`,
          `💬 Sent SMS notifications via Africa's Talking to impacted farmers.`,
          ...prev
        ])
      }

    } catch (err: any) {
      console.error(err)
      setLogs((prev) => [`Error advancing day: ${err.message}`, ...prev])
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = async () => {
    setIsLoading(true)
    try {
      await resetMutation()
      setLogs([
        "Clock reset to Day 18.",
        "Rainfall readings restored to 12mm.",
        "Pending payouts cleared. Active cover restored."
      ])
    } catch (err: any) {
      console.error(err)
      setLogs((prev) => [`Error resetting clock: ${err.message}`, ...prev])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="shadow-md border-border bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <FlameIcon className="size-5 text-primary" />
          <CardTitle className="text-lg font-bold text-foreground">Scenario Simulation Console</CardTitle>
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          Administrative control panel to fast-forward days and trigger the parametric payout engine.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Day Display Card */}
        <div className="p-3 bg-muted/50 rounded-lg border border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CloudSunIcon className="size-5 text-muted-foreground" />
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Timeline</div>
              <div className="text-sm font-semibold text-foreground">Day {currentDay} of 45</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Scenario</div>
            <div className="text-xs font-semibold text-foreground">{scenarioName}</div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={handleAdvanceDay} 
            disabled={isLoading || currentDay >= 45}
            className="flex-1 gap-1.5"
            size="sm"
          >
            <PlayIcon className="size-3.5 fill-current" />
            {isLoading ? "Simulating..." : `Advance to Day ${currentDay + 1}`}
          </Button>
          <Button 
            onClick={handleReset} 
            disabled={isLoading}
            variant="outline" 
            size="sm"
            className="gap-1.5"
          >
            <RotateCcwIcon className="size-3.5" />
            Reset Clock
          </Button>
        </div>

        {/* Information box */}
        <div className="p-3 bg-primary/5 rounded-lg border border-primary/10 flex gap-2.5 text-xs text-muted-foreground leading-relaxed">
          <InfoIcon className="size-4 shrink-0 text-primary mt-0.5" />
          <div>
            <span className="font-semibold text-foreground">Drought Scenario Blueprint:</span> Day 18 starts with 12mm. Days 19, 20, and 21 are programmed with 0mm rain. At Day 21, cumulative rainfall remains 12mm, breaching the 15mm germination threshold and firing instant M-Pesa payouts.
          </div>
        </div>

        {/* Console logs */}
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Event Log</div>
          <div className="h-[120px] bg-muted/75 rounded-lg border border-border p-2.5 font-mono text-[10px] overflow-y-auto space-y-1.5 leading-normal">
            {logs.map((log, index) => {
              const isPayout = log.includes("DROUGHT")
              const isSMS = log.includes("SMS")
              return (
                <div 
                  key={index} 
                  className={`flex gap-1.5 items-start ${
                    isPayout ? "text-amber-500 font-bold" : isSMS ? "text-emerald-500 font-semibold" : "text-muted-foreground"
                  }`}
                >
                  <span className="text-muted-foreground/50 shrink-0">&gt;</span>
                  <span>{log}</span>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
