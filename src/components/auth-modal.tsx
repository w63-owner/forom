"use client"

import { useEffect, useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getSupabaseClient } from "@/utils/supabase/client"
import { useToast } from "@/components/ui/toast"
import { isAbortLikeError } from "@/lib/async-resilience"
import {
  OTP_EXPIRY_MINUTES,
  OTP_LOCKOUT_MINUTES,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  isOtpCodeValid,
  normalizeOtpCode,
  type AuthModalMode,
  type AuthModalStep,
} from "@/lib/security/auth-modal-state"

const FORCE_ONBOARDING_WELCOME_KEY = "forom_force_onboarding_welcome"

type AuthModalProps = {
  open: boolean
  mode: AuthModalMode
  nextPath: string
  onOpenChange: (nextOpen: boolean) => void
  onModeChange: (mode: AuthModalMode) => void
  onSignedIn?: (nextPathOverride?: string) => void
}

type OtpVerifyType = "signup" | "email"
type AuthFlowPhase =
  | "idle"
  | "submitting_credentials"
  | "awaiting_session_confirmation"
  | "authenticated"
  | "error"

export function AuthModal({
  open,
  mode,
  nextPath,
  onOpenChange,
  onModeChange,
  onSignedIn,
}: AuthModalProps) {
  const locale = useLocale()
  const t = useTranslations("Auth")
  const tCommon = useTranslations("Common")
  const { showToast } = useToast()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [step, setStep] = useState<AuthModalStep>("form")
  const [otpEmail, setOtpEmail] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [otpVerifyType, setOtpVerifyType] = useState<OtpVerifyType>("signup")
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null)
  const [otpResendUntil, setOtpResendUntil] = useState<number | null>(null)
  const [otpBlockedUntil, setOtpBlockedUntil] = useState<number | null>(null)
  const [otpAttempts, setOtpAttempts] = useState(0)
  const [otpClock, setOtpClock] = useState<number>(Date.now())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [phase, setPhase] = useState<AuthFlowPhase>("idle")
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null)
  const [cooldownSeconds, setCooldownSeconds] = useState<number | null>(null)

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

  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const appBase =
    process.env.NEXT_PUBLIC_APP_URL &&
    !process.env.NEXT_PUBLIC_APP_URL.includes("localhost")
      ? process.env.NEXT_PUBLIC_APP_URL
      : origin.includes("localhost")
        ? "https://www.forom.app"
        : origin

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

  const safeNextPath = useMemo(
    () => (nextPath && nextPath.startsWith("/") ? nextPath : "/"),
    [nextPath]
  )

  const passwordChecks = useMemo(
    () => ({
      minLength: password.length >= 8,
      number: /\d/.test(password),
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
    }),
    [password]
  )

  const passwordScore = Object.values(passwordChecks).filter(Boolean).length
  const passwordStrength =
    passwordScore >= 4 ? "strong" : passwordScore >= 2 ? "medium" : "weak"

  const otpResendRemainingSeconds = Math.max(
    0,
    Math.ceil(((otpResendUntil ?? 0) - otpClock) / 1000)
  )
  const otpBlockedRemainingSeconds = Math.max(
    0,
    Math.ceil(((otpBlockedUntil ?? 0) - otpClock) / 1000)
  )
  const otpExpiresRemainingSeconds = Math.max(
    0,
    Math.ceil(((otpExpiresAt ?? 0) - otpClock) / 1000)
  )

  useEffect(() => {
    if (step !== "verify_code") return
    const timer = window.setInterval(() => {
      setOtpClock(Date.now())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [step])

  useEffect(() => {
    if (!open) {
      setEmail("")
      setPassword("")
      setError(null)
      setInfo(null)
      setLoading(false)
      setShowPassword(false)
      setCooldownUntil(null)
      setCooldownSeconds(null)
      setStep("form")
      setOtpEmail("")
      setOtpCode("")
      setOtpVerifyType("signup")
      setOtpExpiresAt(null)
      setOtpResendUntil(null)
      setOtpBlockedUntil(null)
      setOtpAttempts(0)
      setOtpClock(Date.now())
      setPhase("idle")
    }
  }, [open])

  useEffect(() => {
    if (mode === "login") {
      setStep("form")
      setOtpCode("")
      setOtpEmail("")
      setOtpVerifyType("signup")
      setOtpExpiresAt(null)
      setOtpResendUntil(null)
      setOtpBlockedUntil(null)
      setOtpAttempts(0)
    }
  }, [mode])

  const confirmSessionAfterTimeout = async () => {
    const supabase = getSupabaseClient()
    if (!supabase) return false
    const delaysMs = [300, 600, 1000, 1500, 2000, 2500, 3000, 4000, 5000]
    for (let index = 0; index < delaysMs.length; index += 1) {
      if (index > 0) {
        await new Promise<void>((resolve) =>
          window.setTimeout(resolve, delaysMs[index - 1])
        )
      }
      try {
        const { data, error: sessionError } = await withTimeout(
          supabase.auth.getSession(),
          5000,
          "getSession confirm"
        )
        if (!sessionError && data.session?.user) {
          return true
        }
      } catch {
        // Ignore local session probe errors and fallback to server check.
      }
      try {
        const response = await withTimeout(
          fetch("/api/auth/session", { cache: "no-store" }),
          7000,
          "session endpoint confirm"
        )
        const payload = (await response.json().catch(() => null)) as
          | { user?: { id?: string | null } | null }
          | null
        if (response.ok && payload?.user?.id) {
          return true
        }
      } catch {
        // Ignore transient API probe failures and keep retrying.
      }
    }
    return false
  }

  const handleEmailAuth = async (requestedMode: AuthModalMode) => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setError(t("supabaseNotConfigured"))
      return
    }

    setLoading(true)
    setError(null)
    setInfo(null)
    setPhase("submitting_credentials")
    const tryRecoverAuthenticatedSession = async () => {
      // Network can be slow: sign-in may succeed after the UI timeout.
      // Probe session a few times before surfacing a hard timeout error.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (attempt > 0) {
          await new Promise<void>((resolve) => window.setTimeout(resolve, 600))
        }
        try {
          const { data, error: sessionError } = await withTimeout(
            supabase.auth.getSession(),
            5000,
            "getSession"
          )
          if (!sessionError && data.session?.user) {
            return true
          }
        } catch {
          // Ignore probe failure and continue retrying.
        }
      }
      return false
    }
    try {
      if (requestedMode === "login") {
        const { error: signInError } = await withTimeout(
          supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
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
          setPhase("error")
          return
        }
        showToast({
          variant: "success",
          title: t("signedInTitle"),
        })
        setPhase("authenticated")
        onSignedIn?.(safeNextPath)
        return
      }

      const { data: signUpData, error: signUpError } = await withTimeout(
        supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            emailRedirectTo: `${appBase}/auth/callback?next=${encodeURIComponent(
              safeNextPath
            )}`,
          },
        }),
        10000,
        "signup"
      )
      if (signUpError) {
        const message =
          signUpError.message === "email rate limit exceeded"
            ? t("tooManyAttempts")
            : signUpError.message
        setError(message)
        showToast({
          variant: "error",
          title: t("signupFailedTitle"),
          description: message,
        })
        if (signUpError.message === "email rate limit exceeded") {
          startCooldown(120)
        }
        setPhase("error")
        return
      }

      const normalizedEmail = email.trim().toLowerCase()
      const now = Date.now()
      setOtpEmail(normalizedEmail)
      setOtpCode("")
      setOtpVerifyType("signup")
      setOtpAttempts(0)
      setOtpBlockedUntil(null)
      setOtpExpiresAt(now + OTP_EXPIRY_MINUTES * 60 * 1000)
      setOtpResendUntil(now + OTP_RESEND_COOLDOWN_SECONDS * 1000)
      setStep("verify_code")
      setInfo(null)
      setPhase("idle")
      showToast({
        variant: "success",
        title: t("accountCreatedTitle"),
        description: t("otpCheckInbox"),
      })
      void signUpData
    } catch (err) {
      if (isAbortLikeError(err)) return
      if (err instanceof Error && err.message.includes("timeout")) {
        if (requestedMode === "login") {
          setPhase("awaiting_session_confirmation")
          setInfo(t("signInCheckingSession"))
          const recovered =
            (await tryRecoverAuthenticatedSession()) ||
            (await confirmSessionAfterTimeout())
          if (recovered) {
            showToast({
              variant: "success",
              title: t("signedInTitle"),
              description: t("signInSessionRecovered"),
            })
            setPhase("authenticated")
            onSignedIn?.(safeNextPath)
            return
          }
        }
        setInfo(null)
        setError(
          requestedMode === "login"
            ? t("signInSessionNotConfirmed")
            : t("verifyTimeout")
        )
        setPhase("error")
        return
      }
      setError(t("genericError"))
      setPhase("error")
      showToast({
        variant: "error",
        title:
          requestedMode === "login" ? t("signInFailedTitle") : t("signupFailedTitle"),
        description: t("genericError"),
      })
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (mode !== "signup" || step !== "verify_code") return
    const supabase = getSupabaseClient()
    if (!supabase) {
      setError(t("supabaseNotConfigured"))
      return
    }
    if (!otpEmail) {
      setError(t("otpMissingEmail"))
      return
    }
    if (otpBlockedRemainingSeconds > 0) {
      setError(
        t("otpTemporarilyBlocked", {
          minutes: Math.ceil(otpBlockedRemainingSeconds / 60),
        })
      )
      return
    }
    if (!isOtpCodeValid(otpCode)) {
      setError(t("otpCodeInvalidFormat"))
      return
    }
    if (otpExpiresRemainingSeconds <= 0) {
      setError(t("otpCodeExpired"))
      return
    }

    setLoading(true)
    setError(null)
    try {
      const { error: verifyError } = await withTimeout(
        supabase.auth.verifyOtp({
          email: otpEmail,
          token: otpCode,
          type: otpVerifyType,
        }),
        10000,
        `verify otp ${otpVerifyType}`
      )
      if (verifyError) {
        const nextAttempts = otpAttempts + 1
        setOtpAttempts(nextAttempts)
        if (nextAttempts >= OTP_MAX_ATTEMPTS) {
          const blockedUntil = Date.now() + OTP_LOCKOUT_MINUTES * 60 * 1000
          setOtpBlockedUntil(blockedUntil)
          setError(
            t("otpTooManyAttempts", {
              minutes: OTP_LOCKOUT_MINUTES,
            })
          )
          return
        }
        setError(
          t("otpInvalidOrExpired", {
            remaining: OTP_MAX_ATTEMPTS - nextAttempts,
          })
        )
        return
      }

      showToast({
        variant: "success",
        title: t("signedInTitle"),
      })
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(FORCE_ONBOARDING_WELCOME_KEY, "1")
      }
      setPhase("authenticated")
      onSignedIn?.(
        `/${locale}/onboarding?welcome=1&next=${encodeURIComponent(safeNextPath)}`
      )
    } catch (err) {
      if (isAbortLikeError(err)) return
      if (err instanceof Error && err.message.includes("timeout")) {
        setError(t("otpVerifyTimeout"))
        setPhase("error")
        return
      }
      setError(t("genericError"))
      setPhase("error")
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (mode !== "signup" || step !== "verify_code") return
    if (otpResendRemainingSeconds > 0 || otpBlockedRemainingSeconds > 0) return
    const supabase = getSupabaseClient()
    if (!supabase) {
      setError(t("supabaseNotConfigured"))
      return
    }
    if (!otpEmail) {
      setError(t("otpMissingEmail"))
      return
    }
    setLoading(true)
    setError(null)
    try {
      // Keep signup/email-password verification type as primary.
      // Fallback to passwordless only if signup resend path fails.
      const { error: resendSignupError } = await withTimeout(
        supabase.auth.resend({
          type: "signup",
          email: otpEmail,
          options: {
            emailRedirectTo: `${appBase}/auth/callback?next=${encodeURIComponent(safeNextPath)}`,
          },
        }),
        10000,
        "resend signup otp"
      )

      if (resendSignupError) {
        const { error: resendEmailError } = await withTimeout(
          supabase.auth.signInWithOtp({
            email: otpEmail,
            options: {
              shouldCreateUser: false,
            },
          }),
          10000,
          "resend email otp"
        )
        if (resendEmailError) {
          setError(resendEmailError.message)
          return
        }
        setOtpVerifyType("email")
      } else {
        setOtpVerifyType("signup")
      }
      const now = Date.now()
      setOtpExpiresAt(now + OTP_EXPIRY_MINUTES * 60 * 1000)
      setOtpResendUntil(now + OTP_RESEND_COOLDOWN_SECONDS * 1000)
      setInfo(null)
    } catch (err) {
      if (isAbortLikeError(err)) return
      setError(t("genericError"))
    } finally {
      setLoading(false)
    }
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
      const { error: resetError } = await withTimeout(
        supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/profile")}`,
        }),
        10000,
        "reset password"
      )
      if (resetError) {
        const message =
          resetError.message === "email rate limit exceeded"
            ? t("tooManyAttempts")
            : resetError.message
        setError(message)
        if (resetError.message === "email rate limit exceeded") {
          startCooldown(120)
        }
        return
      }
      setInfo(t("resetEmailSent"))
    } catch (err) {
      if (isAbortLikeError(err)) return
      if (err instanceof Error && err.message.includes("timeout")) {
        setError(t("resetEmailTimeout"))
        return
      }
      setError(t("genericError"))
    } finally {
      setLoading(false)
    }
  }

  const canSubmit =
    mode === "signup"
      ? !!email.trim() &&
        !!password &&
        cooldownSeconds === null &&
        passwordScore === 4
      : !!email.trim() && !!password && cooldownSeconds === null

  const showVerifyOtp = mode === "signup" && step === "verify_code"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="fixed top-2 left-1/2 -translate-x-1/2 translate-y-0 max-h-[calc(100dvh-1rem)] w-[92vw] max-w-[23rem] overflow-y-auto overflow-x-hidden border border-border bg-background p-6 text-foreground shadow-2xl sm:top-[45%] sm:-translate-y-1/2 sm:max-h-[85vh] sm:max-w-[23rem]"
      >
        <div className="space-y-4">
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="text-3xl font-bold tracking-tight text-foreground">
            {showVerifyOtp
              ? t("otpTitle")
              : mode === "signup"
                ? t("signUpTitle")
                : t("signInTitle")}
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            {showVerifyOtp
              ? t("otpDescription", { email: otpEmail })
              : mode === "signup"
                ? t("signUpDescription")
                : t("signInDescription")}
          </DialogDescription>
        </DialogHeader>

        {!showVerifyOtp ? (
          <div className="mt-2 space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{t("emailLabel")}</label>
              <Input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="john@example.com"
                type="email"
                autoComplete="email"
                className="border-border bg-background text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{t("passwordLabel")}</label>
              <div className="relative">
                <Input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="********"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  className="border-border bg-background pr-10 text-foreground placeholder:text-muted-foreground"
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return
                    event.preventDefault()
                    if (mode === "signup") {
                      if (!canSubmit || loading) return
                      void handleEmailAuth("signup")
                      return
                    }
                    if (!canSubmit || loading) return
                    void handleEmailAuth("login")
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-3 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            {mode === "signup" && password.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-muted-foreground">{t("passwordStrength")}</span>
                  <span
                    className={
                      passwordStrength === "strong"
                        ? "font-semibold text-emerald-600"
                        : passwordStrength === "medium"
                          ? "font-semibold text-amber-600"
                          : "font-semibold text-red-600"
                    }
                  >
                    {passwordStrength === "strong"
                      ? t("passwordStrong")
                      : passwordStrength === "medium"
                        ? t("passwordMedium")
                        : t("passwordWeak")}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className={
                      passwordStrength === "strong"
                        ? "h-2 rounded-full bg-emerald-500 transition-all"
                        : passwordStrength === "medium"
                          ? "h-2 rounded-full bg-amber-500 transition-all"
                          : "h-2 rounded-full bg-red-500 transition-all"
                    }
                    style={{ width: `${(passwordScore / 4) * 100}%` }}
                  />
                </div>
                <ul className="space-y-1 text-sm">
                  <li className={passwordChecks.minLength ? "text-emerald-600" : "text-muted-foreground"}>
                    {passwordChecks.minLength ? "✓" : "✗"} {t("passwordRuleMinLength")}
                  </li>
                  <li className={passwordChecks.number ? "text-emerald-600" : "text-muted-foreground"}>
                    {passwordChecks.number ? "✓" : "✗"} {t("passwordRuleNumber")}
                  </li>
                  <li className={passwordChecks.uppercase ? "text-emerald-600" : "text-muted-foreground"}>
                    {passwordChecks.uppercase ? "✓" : "✗"} {t("passwordRuleUppercase")}
                  </li>
                  <li className={passwordChecks.lowercase ? "text-emerald-600" : "text-muted-foreground"}>
                    {passwordChecks.lowercase ? "✓" : "✗"} {t("passwordRuleLowercase")}
                  </li>
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-2 space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{t("otpCodeLabel")}</label>
              <Input
                value={otpCode}
                onChange={(event) => setOtpCode(normalizeOtpCode(event.target.value))}
                placeholder="123456"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="border-border bg-background text-center text-xl tracking-[0.5em] text-foreground placeholder:text-muted-foreground"
                onPaste={(event) => {
                  event.preventDefault()
                  const pasted = event.clipboardData.getData("text")
                  setOtpCode(normalizeOtpCode(pasted))
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    void handleVerifyOtp()
                  }
                }}
              />
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>{t("otpExpiryHint", { minutes: OTP_EXPIRY_MINUTES })}</p>
              {otpAttempts > 0 && otpBlockedRemainingSeconds === 0 ? (
                <p>{t("otpAttemptsRemaining", { remaining: OTP_MAX_ATTEMPTS - otpAttempts })}</p>
              ) : null}
              {otpBlockedRemainingSeconds > 0 ? (
                <p>
                  {t("otpTemporarilyBlocked", {
                    minutes: Math.ceil(otpBlockedRemainingSeconds / 60),
                  })}
                </p>
              ) : null}
            </div>
          </div>
        )}

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

        <div className="mt-1 space-y-3">
          {!showVerifyOtp ? (
            <Button
              onClick={() => void handleEmailAuth(mode)}
              disabled={loading || !canSubmit}
              className="h-11 w-full bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {loading
                ? phase === "awaiting_session_confirmation"
                  ? t("signInFinalizing")
                  : tCommon("saving")
                : mode === "signup"
                  ? t("createAccount")
                  : t("signInButton")}
            </Button>
          ) : (
            <>
              <Button
                onClick={() => void handleVerifyOtp()}
                disabled={loading || !isOtpCodeValid(otpCode) || otpBlockedRemainingSeconds > 0}
                className="h-11 w-full bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {loading ? tCommon("saving") : t("otpVerifyButton")}
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleResendOtp()}
                disabled={loading || otpResendRemainingSeconds > 0 || otpBlockedRemainingSeconds > 0}
                className="h-10 w-full"
              >
                {otpResendRemainingSeconds > 0
                  ? t("otpResendIn", { seconds: otpResendRemainingSeconds })
                  : t("otpResendButton")}
              </Button>
            </>
          )}

          {mode === "login" && (
            <Button
              variant="ghost"
              onClick={() => void handleForgotPassword()}
              disabled={loading || !email.trim() || cooldownSeconds !== null}
              className="w-full text-muted-foreground hover:text-foreground"
            >
              {t("forgotPassword")}
            </Button>
          )}
        </div>

        {!showVerifyOtp ? (
          <div className="mt-1 text-center text-sm text-muted-foreground">
            {mode === "signup" ? (
              <button
                type="button"
                className="text-muted-foreground"
                onClick={() => onModeChange("login")}
              >
                {t("alreadyHaveAccountPrefix")}{" "}
                <span className="text-primary underline underline-offset-2">
                  {t("alreadyHaveAccountAction")}
                </span>
              </button>
            ) : (
              <button
                type="button"
                className="text-muted-foreground"
                onClick={() => onModeChange("signup")}
              >
                {t("dontHaveAccountPrefix")}{" "}
                <span className="text-primary underline underline-offset-2">
                  {t("dontHaveAccountAction")}
                </span>
              </button>
            )}
          </div>
        ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
