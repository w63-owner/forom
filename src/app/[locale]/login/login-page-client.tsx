"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Alert } from "@/components/ui/alert"
import { getSupabaseClient } from "@/utils/supabase/client"
import { useToast } from "@/components/ui/toast"
import { isAbortLikeError } from "@/lib/async-resilience"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations("Auth")
  const tCommon = useTranslations("Common")
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
  const { showToast } = useToast()
  const logAuth = (message: string, meta?: Record<string, unknown>) => {
    if (process.env.NEXT_PUBLIC_AUTH_DEBUG !== "true") return
    if (meta) {
      console.info(`[auth] ${message}`, meta)
    } else {
      console.info(`[auth] ${message}`)
    }
  }
  const withTimeout = async <T,>(
    promise: PromiseLike<T>,
    ms: number,
    label: string
  ): Promise<T> => {
    let timeoutId: number | undefined
    const timeoutPromise: Promise<T> = new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => {
        reject(new Error(`${label} timeout`))
      }, ms)
    })
    try {
      const result = await Promise.race([Promise.resolve(promise), timeoutPromise])
      return result as T
    } finally {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
      }
    }
  }
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
      setError(t("supabaseNotConfigured"))
      return
    }

    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      const normalizedEmail = email.trim().toLowerCase()
      const { data, error: lookupError } = await withTimeout(
        supabase
          .from("users")
          .select("id")
          .eq("email", normalizedEmail)
          .limit(1),
        10000,
        "check email"
      )

      if (lookupError) {
        setError(lookupError.message || t("genericError"))
        logAuth("check email failed", { message: lookupError.message })
        return
      }

      const exists = Boolean(data && data.length > 0)
      setEmail(normalizedEmail)
      setPassword("")
      setUsername("")
      setStep(exists ? "signin" : "signup")
      logAuth("check email resolved", { exists })
    } catch (err) {
      if (isAbortLikeError(err)) {
        logAuth("check email aborted", { error: "catch" })
        return
      }
      if (err instanceof Error && err.message.includes("timeout")) {
        logAuth("check email timeout")
        setError(t("verifyTimeout"))
        return
      }
      setError(t("genericError"))
      logAuth("check email failed", {
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEmailAuth = async (mode: "signin" | "signup") => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setError(t("supabaseNotConfigured"))
      return
    }

    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      logAuth("email auth start", { mode })
      if (mode === "signin") {
        const { error: signInError } = await withTimeout(
          supabase.auth.signInWithPassword({
            email,
            password,
          }),
          10000,
          "signin"
        )
        if (signInError) {
          const message =
            signInError.message === "email rate limit exceeded"
              ? t("tooManyAttempts")
              : signInError.message === "Invalid login credentials"
                ? t("invalidCredentials")
                : signInError.message
          setError(message)
          if (signInError.message === "email rate limit exceeded") {
            startCooldown(120)
          }
          logAuth("signin error", { message: signInError.message })
          return
        }
      } else {
        const { error: signUpError } = await withTimeout(
          supabase.auth.signUp({
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
          }),
          10000,
          "signup"
        )
        if (signUpError) {
          setError(
            signUpError.message === "email rate limit exceeded"
              ? t("tooManyAttempts")
              : signUpError.message
          )
          showToast({
            variant: "error",
            title: t("signupFailedTitle"),
            description:
              signUpError.message === "email rate limit exceeded"
                ? t("tooManyAttempts")
                : signUpError.message,
          })
          if (signUpError.message === "email rate limit exceeded") {
            startCooldown(120)
          }
          logAuth("signup error", { message: signUpError.message })
          return
        }

        setInfo(t("confirmationEmailSent"))
        showToast({
          variant: "success",
          title: t("accountCreatedTitle"),
          description: t("confirmationEmailSent"),
        })
        return
      }
    } catch (err) {
      if (isAbortLikeError(err)) {
        logAuth("email auth aborted")
        return
      }
      if (err instanceof Error && err.message.includes("timeout")) {
        logAuth("email auth timeout", { mode })
        setError(t("signInTimeout"))
        showToast({
          variant: "error",
          title: t("signInFailedTitle"),
          description: t("signInTimeout"),
        })
        return
      }
      setError(t("genericError"))
      logAuth("email auth failed", {
        message: err instanceof Error ? err.message : String(err),
      })
      showToast({
        variant: "error",
        title: t("signInFailedTitle"),
        description: t("genericError"),
      })
      return
    } finally {
      setLoading(false)
    }
    showToast({
      variant: "success",
      title: t("signedInTitle"),
    })
    router.push(redirectTo)
  }

  const handleForgotPassword = async () => {
    if (!email.trim()) return
    const supabase = getSupabaseClient()
    if (!supabase) {
      setError(t("supabaseNotConfigured"))
      return
    }
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      logAuth("reset password start", { email })
      const { error: resetError } = await withTimeout(
        supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(
            "/profile"
          )}`,
        }),
        10000,
        "reset password"
      )
      if (resetError) {
        setError(
          resetError.message === "email rate limit exceeded"
            ? t("tooManyAttempts")
            : resetError.message
        )
        showToast({
          variant: "error",
          title: t("resetEmailFailedTitle"),
          description:
            resetError.message === "email rate limit exceeded"
              ? t("tooManyAttempts")
              : resetError.message,
        })
        if (resetError.message === "email rate limit exceeded") {
          startCooldown(120)
        }
        logAuth("reset password error", { message: resetError.message })
        return
      }
      setInfo(t("resetEmailSent"))
      showToast({
        variant: "success",
        title: t("resetEmailSentTitle"),
        description: t("resetEmailSent"),
      })
    } catch (err) {
      if (isAbortLikeError(err)) {
        logAuth("reset password aborted")
        return
      }
      if (err instanceof Error && err.message.includes("timeout")) {
        logAuth("reset password timeout")
        setError(t("resetEmailTimeout"))
        showToast({
          variant: "error",
          title: t("resetEmailFailedTitle"),
          description: t("resetEmailTimeout"),
        })
        return
      }
      setError(t("genericError"))
      logAuth("reset password failed", {
        message: err instanceof Error ? err.message : String(err),
      })
      showToast({
        variant: "error",
        title: t("resetEmailFailedTitle"),
        description: t("genericError"),
      })
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-6 py-16">
      <div className="flex w-full max-w-md flex-col gap-3">
        <Link
          href="/"
          className="link-nav inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          onClick={(event) => {
            if (step === "email") {
              return
            }
            event.preventDefault()
            setStep("email")
            setPassword("")
            setError(null)
            setInfo(null)
          }}
        >
          ← {tCommon("back")}
        </Link>
        <Card className="w-full">
          <CardHeader className="space-y-2">
            <CardTitle>
              {step === "signup"
                ? t("signUpTitle")
                : step === "signin"
                ? t("signInTitle")
                : t("authenticationTitle")}
            </CardTitle>
            <CardDescription>
              {step === "signup"
                ? t("signUpDescription")
                : step === "signin"
                ? t("signInDescription")
                : t("authenticationDescription")}
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
                  placeholder={t("usernamePlaceholder")}
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
                  placeholder={t("passwordPlaceholder")}
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
            {error && (
              <Alert variant="error" title={t("errorTitle")}>
                {error}
              </Alert>
            )}
            {cooldownSeconds !== null && cooldownSeconds > 0 && (
              <p className="text-sm text-muted-foreground">
                {t("cooldown", { seconds: cooldownSeconds })}
              </p>
            )}
            {info && <p className="text-sm text-muted-foreground">{info}</p>}

            {step === "email" && (
              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleCheckEmail}
                  disabled={loading || !email.trim() || cooldownSeconds !== null}
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      {t("checking")}
                    </span>
                  ) : (
                    tCommon("continue")
                  )}
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
                  {t("signInButton")}
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleForgotPassword}
                  disabled={loading || !email.trim() || cooldownSeconds !== null}
                >
                  {t("forgotPassword")}
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
                  {t("createAccount")}
                </Button>
              </div>
            )}

          </CardContent>
        </Card>
    </div>
    </div>
  )
}

export default function LoginPageClient() {
  return <LoginForm />
}