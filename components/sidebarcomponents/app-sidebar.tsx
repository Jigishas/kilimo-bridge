"use client"

import * as React from "react"
import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { authClient } from "@/lib/auth-client"

import { NavMain } from "./nav-main"
import { NavUser } from "./nav-user"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  ShieldCheckIcon,
  PlusIcon,
  MailIcon,
  SproutIcon,
  UserPlusIcon,
  XIcon,
  DatabaseIcon,
  MapPinIcon,
  SlidersIcon
} from "lucide-react"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { data: session } = authClient.useSession()
  const tenantData = useQuery(api.tenants.getCurrent)
  const products = useQuery(api.products.list)
  
  const createProductMutation = useMutation(api.products.create)
  const createPolicyMutation = useMutation(api.policies.createManualPolicy)

  // Modal control states
  const [activeModal, setActiveModal] = useState<"product" | "policy" | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  // Product Form State
  const [prodName, setProdName] = useState("")
  const [prodCounty, setProdCounty] = useState("Kitui")
  const [prodCrop, setProdCrop] = useState("maize")
  const [prodPremium, setProdPremium] = useState("250")
  const [prodSumInsured, setProdSumInsured] = useState("12500")
  const [prodP1Threshold, setProdP1Threshold] = useState("15")
  const [prodP2Threshold, setProdP2Threshold] = useState("40")

  // Policy Form State
  const [farmerName, setFarmerName] = useState("")
  const [farmerPhone, setFarmerPhone] = useState("+2547")
  const [farmerCounty, setFarmerCounty] = useState("Kitui")
  const [selectedProductId, setSelectedProductId] = useState("")
  const [policyAcres, setPolicyAcres] = useState("1")

  const resetForms = () => {
    setError("")
    setActiveModal(null)
    setIsLoading(false)
    setFarmerName("")
    setFarmerPhone("+2547")
    setProdName("")
  }

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      await createProductMutation({
        name: prodName,
        county: prodCounty,
        cropType: prodCrop,
        premiumPerAcre: Number(prodPremium),
        sumInsuredPerAcre: Number(prodSumInsured),
        phase1Threshold: Number(prodP1Threshold),
        phase2Threshold: Number(prodP2Threshold),
      })
      resetForms()
    } catch (err: any) {
      console.error(err)
      setError(err.message || "Failed to create product")
      setIsLoading(false)
    }
  }

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    if (!selectedProductId) {
      setError("Please select a product scheme")
      setIsLoading(false)
      return
    }

    try {
      await createPolicyMutation({
        farmerName,
        farmerPhone,
        farmerCounty,
        productId: selectedProductId as any,
        acres: Number(policyAcres),
      })
      resetForms()
    } catch (err: any) {
      console.error(err)
      setError(err.message || "Failed to issue policy")
      setIsLoading(false)
    }
  }

  const tenantName = tenantData?.tenant?.name ?? "Mvua Shield"
  const isPlatformAdmin = tenantData?.isPlatformAdmin ?? false

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
      isActive: pathname === "/dashboard",
    },
    ...(isPlatformAdmin
      ? [
          {
            title: "Demo Control Room",
            url: "/dashboard/simulation",
            icon: <SlidersIcon className="size-4" />,
            isActive: pathname === "/dashboard/simulation",
          },
        ]
      : []),
  ]

  return (
    <Sidebar {...props} className="border-r border-border bg-card">
      <SidebarHeader className="border-b border-border py-4 px-3 flex flex-col gap-3">
        {/* Brand Header */}
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-1">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ShieldCheckIcon className="size-4" />
              </div>
              <span className="text-base font-bold text-foreground tracking-wide">{tenantName}</span>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Quick Create Button */}
        {!isPlatformAdmin && (
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-semibold gap-1.5 justify-start px-3 shadow-sm cursor-pointer" />
                }
              >
                <PlusIcon className="size-4" />
                Quick Create
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuItem 
                  onClick={() => {
                    setActiveModal("product")
                    setProdName("Maize Tariff — " + prodCounty)
                  }}
                  className="cursor-pointer text-xs"
                >
                  <SproutIcon className="size-3.5 mr-2 text-primary" />
                  New Product Scheme
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => {
                    setActiveModal("policy")
                    if (products && products.length > 0) {
                      setSelectedProductId(products[0]._id)
                    }
                  }}
                  className="cursor-pointer text-xs"
                >
                  <UserPlusIcon className="size-3.5 mr-2 text-primary" />
                  Issue Manual Policy
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Email Icon button next to Quick Create */}
            <Button 
              variant="outline" 
              size="icon" 
              className="h-9 w-9 rounded-xl border-border shrink-0 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted/50"
            >
              <MailIcon className="size-4" />
            </Button>
          </div>
        )}
      </SidebarHeader>
      
      <SidebarContent className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-3 space-y-4">
        {/* Main Nav */}
        <NavMain items={navMain} />

        {/* Products Navigation List */}
        {!isPlatformAdmin && (
          <div className="space-y-2">
            <h3 className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <DatabaseIcon className="size-3" />
              Insurance Schemes
            </h3>
            <SidebarMenu>
              {products && products.length > 0 ? (
                products.map((p) => {
                  const isActive = pathname === `/products/${p._id}`
                  return (
                    <SidebarMenuItem key={p._id}>
                      <SidebarMenuButton 
                        isActive={isActive}
                        className="py-1.5 h-auto text-xs w-full"
                        render={<Link href={`/products/${p._id}`} />}
                      >
                        <div className="flex items-center gap-2 w-full truncate">
                          <SproutIcon className={`size-3.5 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                          <div className="text-left truncate w-full flex flex-col">
                            <span className="font-medium text-foreground truncate">{p.name}</span>
                            <span className="text-[10px] text-muted-foreground tracking-wide font-mono flex items-center gap-0.5">
                              <MapPinIcon className="size-2 shrink-0" />
                              {p.county} County
                            </span>
                          </div>
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })
              ) : (
                <div className="px-2 py-3 text-[10px] text-muted-foreground italic leading-relaxed">
                  No active schemes underwritten. Click "Quick Create" to add one!
                </div>
              )}
            </SidebarMenu>
          </div>
        )}
      </SidebarContent>
      
      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>

      {/* Creation Modal Overlays */}
      {activeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-card border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
              <h2 className="text-xs font-bold tracking-wide uppercase text-foreground">
                {activeModal === "product" ? "Create Product Tariff Scheme" : "Issue Manual Policy Onboard"}
              </h2>
              <button 
                onClick={resetForms} 
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
              >
                <XIcon className="size-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 mx-4 mt-4 text-xs text-destructive bg-destructive/10 rounded-md border border-destructive/20 text-center font-medium">
                {error}
              </div>
            )}

            {activeModal === "product" && (
              <form onSubmit={handleCreateProduct} className="p-4 space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground">Product Name</label>
                  <Input 
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    required
                    placeholder="e.g. Maize Index Cover"
                    className="h-8 bg-zinc-950 border-zinc-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-muted-foreground">County Target</label>
                    <Input 
                      value={prodCounty}
                      onChange={(e) => setProdCounty(e.target.value)}
                      required
                      placeholder="e.g. Kitui"
                      className="h-8 bg-zinc-950 border-zinc-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-muted-foreground">Crop Type</label>
                    <Input 
                      value={prodCrop}
                      onChange={(e) => setProdCrop(e.target.value)}
                      required
                      placeholder="e.g. maize"
                      className="h-8 bg-zinc-950 border-zinc-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-muted-foreground">Premium Per Acre (KES)</label>
                    <Input 
                      type="number"
                      value={prodPremium}
                      onChange={(e) => setProdPremium(e.target.value)}
                      required
                      className="h-8 bg-zinc-950 border-zinc-800 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-muted-foreground">Sum Insured Per Acre (KES)</label>
                    <Input 
                      type="number"
                      value={prodSumInsured}
                      onChange={(e) => setProdSumInsured(e.target.value)}
                      required
                      className="h-8 bg-zinc-950 border-zinc-800 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-muted-foreground">Phase 1 Floor (mm)</label>
                    <Input 
                      type="number"
                      value={prodP1Threshold}
                      onChange={(e) => setProdP1Threshold(e.target.value)}
                      required
                      className="h-8 bg-zinc-950 border-zinc-800 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-muted-foreground">Phase 2 Floor (mm)</label>
                    <Input 
                      type="number"
                      value={prodP2Threshold}
                      onChange={(e) => setProdP2Threshold(e.target.value)}
                      required
                      className="h-8 bg-zinc-950 border-zinc-800 font-mono"
                    />
                  </div>
                </div>

                <Button type="submit" disabled={isLoading} className="w-full h-8 mt-2 text-xs">
                  {isLoading ? "Creating Scheme..." : "Add Scheme to Catalog"}
                </Button>
              </form>
            )}

            {activeModal === "policy" && (
              <form onSubmit={handleCreatePolicy} className="p-4 space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground">Farmer Name</label>
                  <Input 
                    value={farmerName}
                    onChange={(e) => setFarmerName(e.target.value)}
                    required
                    placeholder="e.g. John Mutua"
                    className="h-8 bg-zinc-950 border-zinc-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-muted-foreground">Phone Number</label>
                    <Input 
                      value={farmerPhone}
                      onChange={(e) => setFarmerPhone(e.target.value)}
                      required
                      placeholder="+254711000001"
                      className="h-8 bg-zinc-950 border-zinc-800 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-muted-foreground">Farming County</label>
                    <Input 
                      value={farmerCounty}
                      onChange={(e) => setFarmerCounty(e.target.value)}
                      required
                      placeholder="e.g. Kitui"
                      className="h-8 bg-zinc-950 border-zinc-800"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground">Select Product Scheme</label>
                  {products && products.length > 0 ? (
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className="w-full h-8 px-2 rounded-lg bg-zinc-950 border border-zinc-800 text-foreground text-xs"
                    >
                      {products.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name} (Premium KES {p.premiumPerAcre}/Acre)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-[10px] text-destructive bg-destructive/10 p-2 rounded-md">
                      No active product schemas available. Add a product scheme first.
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground">Cover Acreage</label>
                  <Input 
                    type="number"
                    value={policyAcres}
                    onChange={(e) => setPolicyAcres(e.target.value)}
                    required
                    className="h-8 bg-zinc-950 border-zinc-800 font-mono"
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={isLoading || !products || products.length === 0} 
                  className="w-full h-8 mt-2 text-xs"
                >
                  {isLoading ? "Underwriting Policy..." : "Onboard & Issue Active Policy"}
                </Button>
              </form>
            )}
          </Card>
        </div>
      )}
    </Sidebar>
  )
}