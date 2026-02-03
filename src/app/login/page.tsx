"use client"

import Link from "next/link"
import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getSupabaseClient } from "@/utils/supabase/client"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = useMemo(() => searchParams.get("next") ?? "/", [searchParams])
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [step, setStep] = useState<"email" | "signin" | "signup">("email")
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null)
  const [cooldownSeconds, setCooldownSeconds] = useState<number | null>(null)
  const startCooldown = (seconds: number) => {
    const until = Date.now() + seconds * 1000
    setCooldownUntil(until)
    setCooldownSeconds(seconds)
  }

  useEffect(() => {
    if (!cooldownUntil) return
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000))
      setCooldownSeconds(remaining)
      if (remaining <= 0) {
        window.clearInterval(timer)
        setCooldownUntil(null)
        setCooldownSeconds(null)
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [cooldownUntil])

  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const appBase =
    process.env.NEXT_PUBLIC_APP_URL &&
    !process.env.NEXT_PUBLIC_APP_URL.includes("localhost")
      ? process.env.NEXT_PUBLIC_APP_URL
      : origin.includes("localhost")
      ? "https://www.forom.app"
      : origin

  const handleCheckEmail = async () => {
    if (!email.trim()) return
    const supabase = getSupabaseClient()
    if (!supabase) {
      setError("Supabase non configuré.")
      return
    }
    setLoading(true)
    setError(null)
    setInfo(null)
    const { data, error: checkError } = await supabase
      .from("users")
      .select("id")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle()
    if (checkError) {
      setError(
        checkError.message === "email rate limit exceeded"
          ? "Trop de tentatives. Réessayez dans quelques minutes."
          : checkError.message
      )
      if (checkError.message === "email rate limit exceeded") {
        startCooldown(120)
      }
      setLoading(false)
      return
    }
    setStep(data ? "signin" : "signup")
    setLoading(false)
  }

  const handleEmailAuth = async (mode: "signin" | "signup") => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setError("Supabase non configuré.")
      return
    }

    setLoading(true)
    setError(null)
    setInfo(null)
    if (mode === "signin") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
    if (signInError) {
      setError(
        signInError.message === "email rate limit exceeded"
          ? "Trop de tentatives. Réessayez dans quelques minutes."
          : signInError.message
      )
      if (signInError.message === "email rate limit exceeded") {
        startCooldown(120)
      }
        setLoading(false)
        return
      }
    } else {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username.trim(),
          },
          emailRedirectTo: `${appBase}/auth/callback?next=${encodeURIComponent(
            redirectTo
          )}`,
        },
      })
      if (signUpError) {
        setError(
          signUpError.message === "email rate limit exceeded"
            ? "Trop de tentatives. Réessayez dans quelques minutes."
            : signUpError.message
        )
        if (signUpError.message === "email rate limit exceeded") {
          startCooldown(120)
        }
        setLoading(false)
        return
      }

      setInfo("Un email de confirmation vous a été envoyé.")
      setLoading(false)
      return
    }

    setLoading(false)
    router.push(redirectTo)
  }

  const handleForgotPassword = async () => {
    if (!email.trim()) return
    const supabase = getSupabaseClient()
    if (!supabase) {
      setError("Supabase non configuré.")
      return
    }
    setLoading(true)
    setError(null)
    setInfo(null)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/profile")}`,
      }
    )
    if (resetError) {
      setError(
        resetError.message === "email rate limit exceeded"
          ? "Trop de tentatives. Réessayez dans quelques minutes."
          : resetError.message
      )
      if (resetError.message === "email rate limit exceeded") {
        startCooldown(120)
      }
      setLoading(false)
      return
    }
    setInfo("Email de réinitialisation envoyé.")
    setLoading(false)
  }


  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-6 py-16">
      <div className="flex w-full max-w-md flex-col gap-3">
        <Button
          size="sm"
          variant="ghost"
          className="w-fit"
          onClick={() => {
            if (step === "email") {
              router.push("/")
              return
            }
            setStep("email")
            setPassword("")
            setError(null)
            setInfo(null)
          }}
        >
          ← Retour
        </Button>
        <Card className="w-full">
          <CardHeader className="space-y-2">
          <CardTitle>
            {step === "signup"
              ? "Inscription"
              : step === "signin"
              ? "Connexion"
              : "Authentification"}
          </CardTitle>
          <CardDescription>
            {step === "signup"
              ? "Inscrivez-vous pour voter et gérer vos propositions."
              : step === "signin"
              ? "Connectez-vous pour voter et gérer vos propositions."
              : "Connectez-vous / Inscrivez-vous pour voter et gérer vos propositions."}
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
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    if (step === "email") {
                      handleCheckEmail()
                    } else if (step === "signin") {
                      handleEmailAuth("signin")
                    } else if (step === "signup") {
                      handleEmailAuth("signup")
                    }
                  }
                }}
              />
              {step === "signup" && (
                <Input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Pseudo"
                  autoComplete="username"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      handleEmailAuth("signup")
                    }
                  }}
                />
              )}
              {step !== "email" && (
                <Input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Mot de passe"
                  type="password"
                  autoComplete="current-password"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      if (step === "signin") {
                        handleEmailAuth("signin")
                      } else if (step === "signup") {
                        handleEmailAuth("signup")
                      }
                    }
                  }}
                />
              )}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {cooldownSeconds !== null && cooldownSeconds > 0 && (
              <p className="text-sm text-muted-foreground">
                Réessayez dans {cooldownSeconds}s.
              </p>
            )}
            {info && <p className="text-sm text-muted-foreground">{info}</p>}

            {step === "email" && (
              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleCheckEmail}
                  disabled={loading || !email.trim() || cooldownSeconds !== null}
                >
                  Continuer
                </Button>
              </div>
            )}

            {step === "signin" && (
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => handleEmailAuth("signin")}
                  disabled={
                    loading || !email.trim() || !password || cooldownSeconds !== null
                  }
                >
                  Se connecter
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleForgotPassword}
                  disabled={loading || !email.trim() || cooldownSeconds !== null}
                >
                  Mot de passe oublié
                </Button>
              </div>
            )}

            {step === "signup" && (
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => handleEmailAuth("signup")}
                  disabled={
                    loading ||
                    !email.trim() ||
                    !password ||
                    !username.trim() ||
                    cooldownSeconds !== null
                  }
                >
                  Créer un compte
                </Button>
              </div>
            )}

          </CardContent>
        </Card>
    </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-muted/40 px-6 py-16" />}>
      <LoginForm />
    </Suspense>
  )
}
