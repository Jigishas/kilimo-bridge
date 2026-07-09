"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  PhoneIcon, 
  SendIcon, 
  XIcon, 
  SmartphoneIcon,
  WifiIcon,
  BatteryIcon,
  RotateCcwIcon,
  CheckCircleIcon,
  ClockIcon
} from "lucide-react"

export function UssdSimulator() {
  const handleUssdMutation = useMutation(api.ussd.handleUssd)
  const confirmPaymentMutation = useMutation(api.payments.simulatePaymentSuccess)


  // Simulation states
  const [phoneNumber, setPhoneNumber] = useState("+254711000001")
  const [sessionId, setSessionId] = useState("")
  const [isDialed, setIsDialed] = useState(false)
  const [cumulativeText, setCumulativeText] = useState("")
  const [menuText, setMenuText] = useState("")
  const [userInput, setUserInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [mPesaCheckoutId, setMPesaCheckoutId] = useState<string | null>(null)
  const [mPesaLoading, setMpesaLoading] = useState(false)

  const handleDial = async () => {
    setIsLoading(true)
    const newSessionId = `sess_${Math.random().toString(36).substring(2, 9)}`
    setSessionId(newSessionId)
    setCumulativeText("")
    setUserInput("")
    setMPesaCheckoutId(null)

    try {
      const response = await handleUssdMutation({
        sessionId: newSessionId,
        phoneNumber,
        text: "",
      })
      setMenuText(response)
      setIsDialed(true)
    } catch (err: any) {
      console.error(err)
      setMenuText("END Connection error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!userInput.trim()) return

    setIsLoading(true)
    const nextText = cumulativeText === "" ? userInput : `${cumulativeText}*${userInput}`
    setCumulativeText(nextText)
    const currentInput = userInput
    setUserInput("")

    try {
      const response = await handleUssdMutation({
        sessionId,
        phoneNumber,
        text: nextText,
      })
      setMenuText(response)

      // Detect if payment was initiated (Check if response mentions M-Pesa STK push)
      if (response.includes("STK Push initiated") || response.includes("STK push")) {
        // We can parse or simulate a checkout ID
        setMPesaCheckoutId(`ws_CO_${Math.random().toString(36).substring(2, 10).toUpperCase()}`)
      }
    } catch (err: any) {
      console.error(err)
      setMenuText("END Connection error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSimulatePayment = async () => {
    if (!mPesaCheckoutId) return
    setMpesaLoading(true)
    try {
      await confirmPaymentMutation({
        checkoutRequestId: mPesaCheckoutId,
      })

      setMenuText("END payment confirmed. Your crop policy is now active! An SMS confirmation has been sent.")
      setMPesaCheckoutId(null)
    } catch (err) {
      console.error(err)
    } finally {
      setMpesaLoading(false)
    }
  }

  const handleHangup = () => {
    setIsDialed(false)
    setCumulativeText("")
    setMenuText("")
    setUserInput("")
    setMPesaCheckoutId(null)
  }

  const cleanMenuText = (text: string) => {
    if (text.startsWith("CON ")) return text.substring(4)
    if (text.startsWith("END ")) return text.substring(4)
    return text
  }

  const isMenuEnd = menuText.startsWith("END ")

  return (
    <Card className="shadow-md border-border bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <SmartphoneIcon className="size-5 text-primary" />
          <CardTitle className="text-lg font-bold text-foreground">USSD & Checkout Simulator</CardTitle>
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          Simulate a smallholder farmer registering or buying crop insurance using a basic phone.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex flex-col items-center justify-center p-4">
        {/* Smartphone Wrapper */}
        <div className="relative w-[280px] h-[500px] bg-zinc-900 rounded-[36px] p-3 shadow-2xl border-4 border-zinc-800 flex flex-col overflow-hidden">
          {/* Speaker / Camera notches */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-4 bg-zinc-900 rounded-b-xl z-20 flex justify-center items-center gap-2">
            <div className="w-10 h-1 bg-zinc-700 rounded-full"></div>
            <div className="size-1.5 bg-zinc-800 rounded-full"></div>
          </div>

          {/* Screen StatusBar */}
          <div className="h-6 px-4 pt-1 text-[9px] text-zinc-500 font-medium flex justify-between items-center z-10">
            <span>9:41 AM</span>
            <div className="flex gap-1.5 items-center">
              <WifiIcon className="size-2.5" />
              <span>4G</span>
              <BatteryIcon className="size-2.5" />
            </div>
          </div>

          {/* Screen Content */}
          <div className="flex-1 bg-black rounded-[24px] p-4 flex flex-col justify-between border border-zinc-950 font-sans relative">
            
            {!isDialed ? (
              // Off Screen / Dial Pad
              <div className="flex-1 flex flex-col justify-between py-4">
                <div className="space-y-4">
                  <div className="text-center text-zinc-500 text-[10px] uppercase font-bold tracking-wider pt-2">
                    Enter phone & dial shortcode
                  </div>
                  
                  {/* Phone input */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider block">Farmer Phone</label>
                    <Input 
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+254711000001"
                      className="h-8 bg-zinc-950 border-zinc-800 text-xs text-foreground placeholder:text-zinc-700 font-mono"
                    />
                  </div>

                  {/* USSD Shortcode display */}
                  <div className="p-3 bg-zinc-950 border border-zinc-900 rounded-lg text-center">
                    <div className="text-[10px] text-zinc-600">Dialing Target</div>
                    <div className="text-base font-bold text-primary font-mono tracking-wider mt-0.5">*384*4#</div>
                  </div>
                </div>

                <Button 
                  onClick={handleDial} 
                  disabled={isLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-full flex gap-2 items-center justify-center font-bold text-xs"
                >
                  <PhoneIcon className="size-3.5 fill-current" />
                  Dial *384*4#
                </Button>
              </div>
            ) : (
              // On Screen / Active USSD dialog
              <div className="flex-1 flex flex-col justify-between py-2 text-xs">
                
                {/* Dialogue Area */}
                <div className="flex-1 flex flex-col">
                  {/* Menu text panel */}
                  <div className="flex-1 bg-zinc-950 rounded-lg border border-zinc-900 p-3 text-zinc-200 font-mono leading-relaxed overflow-y-auto whitespace-pre-line text-[11px]">
                    {cleanMenuText(menuText)}
                  </div>
                </div>

                {/* Input Control / Actions */}
                <div className="mt-3 space-y-2">
                  {!isMenuEnd ? (
                    <form onSubmit={handleSend} className="flex gap-2">
                      <Input 
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        placeholder="Enter selection..."
                        disabled={isLoading}
                        autoFocus
                        className="flex-1 h-8 bg-zinc-950 border-zinc-800 text-xs text-foreground font-mono"
                      />
                      <Button 
                        type="submit" 
                        disabled={isLoading || !userInput.trim()} 
                        size="icon" 
                        className="h-8 w-8 rounded-lg bg-primary hover:bg-primary/95 text-primary-foreground shrink-0"
                      >
                        <SendIcon className="size-3.5" />
                      </Button>
                    </form>
                  ) : (
                    <Button 
                      onClick={handleHangup}
                      className="w-full bg-zinc-800 hover:bg-zinc-700 text-foreground font-semibold rounded-lg h-8"
                    >
                      Dismiss
                    </Button>
                  )}

                  {/* Hangup button */}
                  {!isMenuEnd && (
                    <Button 
                      onClick={handleHangup}
                      variant="destructive"
                      className="w-full text-xs font-semibold rounded-lg h-8 gap-1.5"
                    >
                      <XIcon className="size-3.5" />
                      Hangup Session
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Home Button notch */}
          <div className="h-6 flex justify-center items-center">
            <div className="w-20 h-1 bg-zinc-700 rounded-full"></div>
          </div>
        </div>

        {/* Live M-Pesa STK Push Overlay Mock */}
        {mPesaCheckoutId && (
          <div className="mt-4 w-full p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex flex-col gap-2 animate-bounce">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-500 flex gap-1 items-center">
                <ClockIcon className="size-3.5 animate-spin" />
                M-Pesa STK Push Pending
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">{mPesaCheckoutId}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              A payment request has been sent to Safaricom Daraja for KES 250. Click below to simulate the customer entering their M-Pesa PIN.
            </p>
            <Button 
              onClick={handleSimulatePayment} 
              disabled={mPesaLoading}
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs h-7 gap-1"
            >
              <CheckCircleIcon className="size-3.5" />
              {mPesaLoading ? "Authorizing..." : "Simulate PIN Entry (KES 250)"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
