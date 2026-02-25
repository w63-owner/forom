"use client"

import { useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { AtSign, Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type OnboardingProfileStepProps = {
  fullName: string
  username: string
  loading: boolean
  error: string | null
  onFullNameChange: (value: string) => void
  onUsernameChange: (value: string) => void
  onSubmit: () => void
}

const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/i

export function OnboardingProfileStep({
  fullName,
  username,
  loading,
  error,
  onFullNameChange,
  onUsernameChange,
  onSubmit,
}: OnboardingProfileStepProps) {
  const t = useTranslations("OnboardingProfile")
  const fullNameValid = fullName.trim().length >= 2
  const normalizedUsername = username.trim().toLowerCase()
  const usernameValid = USERNAME_PATTERN.test(normalizedUsername)
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    if (!usernameValid) {
      setCheckingAvailability(false)
      setUsernameAvailable(null)
      return
    }

    let isActive = true
    setCheckingAvailability(true)
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/onboarding/profile?username=${encodeURIComponent(normalizedUsername)}`,
          { cache: "no-store" }
        )
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; available?: boolean }
          | null
        if (!isActive) return
        if (!response.ok || !payload?.ok) {
          setUsernameAvailable(null)
          return
        }
        setUsernameAvailable(Boolean(payload.available))
      } catch {
        if (!isActive) return
        setUsernameAvailable(null)
      } finally {
        if (!isActive) return
        setCheckingAvailability(false)
      }
    }, 280)

    return () => {
      window.clearTimeout(timer)
      isActive = false
      setCheckingAvailability(false)
    }
  }, [normalizedUsername, usernameValid])

  const canContinue = useMemo(
    () =>
      fullNameValid &&
      usernameValid &&
      usernameAvailable === true &&
      !checkingAvailability &&
      !loading,
    [fullNameValid, usernameValid, usernameAvailable, checkingAvailability, loading]
  )

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">{t("title")}</h2>
        <p className="text-base text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">{t("fullNameLabel")}</label>
          <Input
            value={fullName}
            onChange={(event) => onFullNameChange(event.target.value)}
            placeholder={t("fullNamePlaceholder")}
            className="h-11"
          />
          {!fullNameValid && fullName.length > 0 && (
            <p className="text-xs text-destructive">{t("fullNameError")}</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">{t("usernameLabel")}</label>
          <div className="relative">
            <AtSign className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={username}
              onChange={(event) =>
                onUsernameChange(event.target.value.replace(/@/g, "").toLowerCase())
              }
              placeholder={t("usernamePlaceholder")}
              className={`h-11 pl-11 pr-11 ${
                username.length === 0
                  ? ""
                  : usernameValid && usernameAvailable === true
                    ? "border-emerald-500 focus-visible:ring-emerald-500/30"
                    : usernameValid && usernameAvailable === false
                      ? "border-destructive focus-visible:ring-destructive/30"
                      : usernameValid
                        ? "border-border"
                    : "border-destructive focus-visible:ring-destructive/30"
              }`}
            />
            {usernameValid && usernameAvailable === true ? (
              <Check className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-emerald-500" />
            ) : null}
          </div>
          {!usernameValid && username.length > 0 && (
            <p className="text-xs text-destructive">
              {t("usernameFormatError")}
            </p>
          )}
          {usernameValid && checkingAvailability ? (
            <p className="text-xs text-muted-foreground">{t("checkingAvailability")}</p>
          ) : null}
          {usernameValid && usernameAvailable === true ? (
            <p className="text-xs text-emerald-600">{t("usernameAvailable")}</p>
          ) : null}
          {usernameValid && usernameAvailable === false ? (
            <p className="text-xs text-destructive">{t("usernameTaken")}</p>
          ) : null}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button
          onClick={onSubmit}
          disabled={!canContinue}
          className="h-11 min-w-36 text-base font-semibold"
        >
          {loading ? t("saving") : t("continue")}
        </Button>
      </div>
    </div>
  )
}
