"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getSupabaseClient } from "@/utils/supabase/client"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = useMemo(() => searchParams.get("next") ?? "/", [searchParams])
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const origin = typeof window !== "undefined" ? window.location.origin : ""

  const handleEmailAuth = async (mode: "signin" | "signup") => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setError("Supabase non configuré.")
      return
    }

    setLoading(true)
    setError(null)
    if (mode === "signin") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }
    } else {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })
      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }

      if (data.user) {
        await supabase.from("users").insert({
          id: data.user.id,
          email: data.user.email,
        })
      }
    }

    setLoading(false)
    router.push(redirectTo)
  }

  const handleOAuth = async (provider: "google" | "github") => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setError("Supabase non configuré.")
      return
    }
    setLoading(true)
    setError(null)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(
          redirectTo
        )}`,
      },
    })
    if (oauthError) {
      setError(oauthError.message)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-6 py-16">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle>Connexion</CardTitle>
          <CardDescription>
            Connectez-vous pour voter et gérer vos propositions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              type="email"
              autoComplete="email"
            />
            <Input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mot de passe"
              type="password"
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => handleEmailAuth("signin")}
              disabled={loading || !email || !password}
            >
              Se connecter
            </Button>
            <Button
              variant="outline"
              onClick={() => handleEmailAuth("signup")}
              disabled={loading || !email || !password}
            >
              Créer un compte
            </Button>
          </div>
          <div className="space-y-2">
            <Button
              variant="secondary"
              onClick={() => handleOAuth("google")}
              disabled={loading}
            >
              Continuer avec Google
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleOAuth("github")}
              disabled={loading}
            >
              Continuer avec GitHub
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
