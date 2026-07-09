"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { 
  ShieldCheckIcon, 
  ShieldAlertIcon, 
  ClockIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  SearchIcon,
  XIcon
} from "lucide-react"

export interface PolicyRow {
  _id: string
  farmerName: string
  farmerPhone: string
  farmerCounty: string
  productName: string
  acres: number
  premiumPaid: number
  sumInsured: number
  status: "ACTIVE" | "PAID_OUT" | "PENDING_PAYMENT" | "LAPSED"
  tenantName?: string
}


export function DataTable({ data }: { data: PolicyRow[] }) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [statusTab, setStatusTab] = React.useState<string>("all")

  // Filter data based on status tab selection
  const filteredData = React.useMemo(() => {
    if (statusTab === "all") return data
    if (statusTab === "active") return data.filter((p) => p.status === "ACTIVE")
    if (statusTab === "paid_out") return data.filter((p) => p.status === "PAID_OUT")
    if (statusTab === "pending") return data.filter((p) => p.status === "PENDING_PAYMENT")
    return data
  }, [data, statusTab])

  const columns = React.useMemo<ColumnDef<PolicyRow>[]>(() => {
    const cols: ColumnDef<PolicyRow>[] = []

    // 1. Tenant (Insurer) Column - shown if data has tenantName
    if (data.some(d => d.tenantName)) {
      cols.push({
        accessorKey: "tenantName",
        header: "Insurer",
        cell: ({ row }) => (
          <div className="font-semibold text-foreground text-xs uppercase tracking-wider">
            {row.original.tenantName}
          </div>
        ),
      })
    }

    // 2. Farmer Column
    cols.push({
      accessorKey: "farmerName",
      header: "Farmer",
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-foreground text-sm">{row.original.farmerName}</div>
          <div className="text-xs text-muted-foreground">{row.original.farmerCounty} County</div>
        </div>
      ),
    })

    // 3. Phone Column
    cols.push({
      accessorKey: "farmerPhone",
      header: "Phone",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.farmerPhone}</span>
      ),
    })

    // 4. Product Column
    cols.push({
      accessorKey: "productName",
      header: "Product",
      cell: ({ row }) => (
        <div className="max-w-[200px] truncate text-xs font-medium text-foreground/80">
          {row.original.productName}
        </div>
      ),
    })

    // 5. Acreage Column
    cols.push({
      accessorKey: "acres",
      header: "Acreage",
      cell: ({ row }) => (
        <span className="tabular-nums text-xs">{row.original.acres} Acres</span>
      ),
    })

    // 6. Premium Column
    cols.push({
      accessorKey: "premiumPaid",
      header: "Premium",
      cell: ({ row }) => (
        <span className="tabular-nums font-medium text-xs">KES {row.original.premiumPaid.toLocaleString()}</span>
      ),
    })

    // 7. Sum Insured Column
    cols.push({
      accessorKey: "sumInsured",
      header: "Sum Insured",
      cell: ({ row }) => (
        <span className="tabular-nums font-semibold text-xs text-foreground">
          KES {row.original.sumInsured.toLocaleString()}
        </span>
      ),
    })

    // 8. Status Column
    cols.push({
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status
        if (status === "ACTIVE") {
          return (
            <Badge variant="outline" className="flex w-fit items-center gap-1.5 border-emerald-500/20 text-emerald-600 bg-emerald-500/10 dark:bg-emerald-950/20 dark:text-emerald-400 py-0.5 px-2">
              <ShieldCheckIcon className="size-3" />
              Active Cover
            </Badge>
          )
        }
        if (status === "PAID_OUT") {
          return (
            <Badge variant="outline" className="flex w-fit items-center gap-1.5 border-amber-500/20 text-amber-600 bg-amber-500/10 dark:bg-amber-950/20 dark:text-amber-400 py-0.5 px-2 animate-pulse">
              <ShieldAlertIcon className="size-3" />
              Paid Out
            </Badge>
          )
        }
        if (status === "LAPSED") {
          return (
            <Badge variant="outline" className="flex w-fit items-center gap-1.5 border-rose-500/20 text-rose-600 bg-rose-500/10 dark:bg-rose-950/20 dark:text-rose-400 py-0.5 px-2">
              <XIcon className="size-3" />
              Lapsed
            </Badge>
          )
        }
        return (
          <Badge variant="outline" className="flex w-fit items-center gap-1.5 border-zinc-500/20 text-zinc-500 bg-zinc-500/10 dark:bg-zinc-950/20 dark:text-zinc-400 py-0.5 px-2">
            <ClockIcon className="size-3" />
            Pending M-Pesa
          </Badge>
        )
      },
    })


    return cols
  }, [data])

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: {
        pageSize: 7,
      },
    },
  })

  return (
    <div className="space-y-4 px-4 lg:px-6">
      {/* Filters and Search Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by farmer name..."
            value={(table.getColumn("farmerName")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("farmerName")?.setFilterValue(event.target.value)
            }
            className="pl-9 bg-card border-border"
          />
        </div>

        {/* Status Tabs */}
        <Tabs defaultValue="all" onValueChange={setStatusTab} className="w-fit">
          <TabsList className="bg-muted border border-border">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active Cover</TabsTrigger>
            <TabsTrigger value="paid_out">Paid Out</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Table Container */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50 border-b border-border">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="text-muted-foreground font-semibold">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="border-b border-border hover:bg-muted/30"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No policy records found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          Showing {table.getRowModel().rows?.length} of {filteredData.length} policies
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="size-8"
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <span className="font-medium text-foreground">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="size-8"
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
