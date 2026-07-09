"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      // 1. Try to sign in
      const res = await authClient.signIn.email({
        email,
        password,
      })

      if (res?.error) {
        // 2. If sign in fails, and it is a seeded demo admin, perform auto-signup
        const isSeededEmail = [
          "admin@mvua.shield",
          "admin@kilimosure.co.ke",
          "admin@mavunocover.co.ke",
        ].includes(email)

        if (isSeededEmail) {
          console.log(`Auto-registering seeded account: ${email}`)
          const signUpRes = await authClient.signUp.email({
            email,
            password,
            name: email.split("@")[0].replace("admin", "Admin").trim() || "Admin",
          })

          if (signUpRes?.error) {
            setError(signUpRes.error.message || "Failed to create account")
            setIsLoading(false)
            return
          }
          
          router.push("/dashboard")
        } else {
          setError(res.error.message || "Authentication failed")
        }
      } else {
        router.push("/dashboard")
      }
    } catch (err) {
      console.error(err)
      setError("An unexpected error occurred during login.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn("flex flex-col gap-6", className)} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold text-foreground">Login to your account</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Enter your email below to login to your dashboard
          </p>
        </div>
        
        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20 text-center font-medium">
            {error}
          </div>
        )}

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input 
            id="email" 
            type="email" 
            placeholder="admin@kilimosure.co.ke" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required 
            disabled={isLoading}
          />
        </Field>
        
        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">Password</FieldLabel>
          </div>
          <Input 
            id="password" 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
            disabled={isLoading}
          />
        </Field>
        
        <Field>
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Authenticating..." : "Login"}
          </Button>
        </Field>
        
        <FieldSeparator>Demo Credentials</FieldSeparator>
        
        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg border border-border flex flex-col gap-1.5 font-mono">
          <div>• Kilimo Sure: admin@kilimosure.co.ke</div>
          <div>• Mavuno Cover: admin@mavunocover.co.ke</div>
          <div>• Platform: admin@mvua.shield</div>
          <div className="text-[10px] text-muted-foreground/80 mt-1 italic font-sans">
            Use any password (auto-registers on first login)
          </div>
        </div>
      </FieldGroup>
    </form>
  )
}
