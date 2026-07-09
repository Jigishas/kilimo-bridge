"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ReferenceLine, Tooltip, ResponsiveContainer } from "recharts"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  type ChartConfig,
} from "@/components/ui/chart"

const chartConfig = {
  cumulative: {
    label: "Observed Rainfall",
    color: "var(--primary)",
  },
  threshold: {
    label: "Drought Payout Threshold",
    color: "hsl(var(--destructive))",
  },
} satisfies ChartConfig

export function ChartAreaInteractive() {
  const simState = useQuery(api.simulation.getState)
  const readings = useQuery(api.simulation.getWeatherReadings, { county: "Kitui" })

  const currentDay = simState?.dayIndex ?? 18
  const scenarioName = simState?.scenarioName ?? "Kitui Drought 2026"

  // Process data for the 45-day season clock
  const data = React.useMemo(() => {
    const list = []
    let lastCumulative = 0

    for (let day = 1; day <= 45; day++) {
      // Find reading for this day
      const reading = readings?.find((r) => r.dayIndex === day)
      
      if (reading) {
        lastCumulative = reading.cumulativeMm
      }

      // If we are past the current simulation day, do not show future observed rain
      const observedRain = day <= currentDay ? lastCumulative : null
      const threshold = day <= 21 ? 15 : 40

      list.push({
        dayIndex: day,
        dayLabel: `Day ${day}`,
        rainfall: observedRain,
        threshold: threshold,
      })
    }
    return list
  }, [readings, currentDay])

  return (
    <Card className="@container/card shadow-md border-border bg-card">
      <CardHeader className="flex flex-col gap-1.5 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-foreground">Kitui Satellite Rainfall Index</CardTitle>
          <div className="text-xs font-semibold px-2 py-1 bg-primary/10 text-primary rounded-full">
            {scenarioName} (Current: Day {currentDay})
          </div>
        </div>
        <CardDescription className="text-sm text-muted-foreground">
          Real-time cumulative satellite measurements (mm) vs index payout thresholds (15mm Germination / 40mm Vegetative)
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="fillRainfall" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--primary)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--primary)"
                    stopOpacity={0.01}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="dayIndex"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                stroke="hsl(var(--muted-foreground))"
                ticks={[1, 10, 21, 30, 45]}
                tickFormatter={(val) => `Day ${val}`}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                stroke="hsl(var(--muted-foreground))"
                domain={[0, 60]}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload
                    return (
                      <div className="bg-popover border border-border p-3 rounded-lg shadow-md flex flex-col gap-1 text-xs">
                        <p className="font-bold text-foreground">Day {data.dayIndex}</p>
                        <p className="text-primary font-semibold">
                          Observed: {data.rainfall !== null ? `${data.rainfall} mm` : "N/A"}
                        </p>
                        <p className="text-destructive font-semibold">
                          Threshold: {data.threshold} mm
                        </p>
                      </div>
                    )
                  }
                  return null;
                }}
              />
              
              {/* Germination/Vegetative Phase Shading Divider */}
              <ReferenceLine
                x={21}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="3 3"
                label={{
                  value: "Phase 1 / 2 Boundary",
                  position: "insideTopRight",
                  className: "text-[10px] fill-muted-foreground font-semibold",
                }}
              />

              {/* Threshold Band Line */}
              <Area
                name="Payout Threshold"
                dataKey="threshold"
                type="step"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                strokeDasharray="4 4"
                fill="none"
              />

              {/* Observed Rainfall Area */}
              <Area
                name="Observed Rainfall"
                dataKey="rainfall"
                type="monotone"
                fill="url(#fillRainfall)"
                stroke="var(--primary)"
                strokeWidth={3}
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
