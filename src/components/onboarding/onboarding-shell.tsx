"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, FileText, Lightbulb, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OnboardingProfileStep } from "@/components/onboarding/onboarding-profile-step"
import { OnboardingAvatarStep } from "@/components/onboarding/onboarding-avatar-step"

type OnboardingShellProps = {
  initialUsername: string
  initialAvatarUrl: string
  forceWelcome?: boolean
  onCompleted: () => void
}

type Step = "welcome" | "profile" | "avatar"

export function OnboardingShell({
  initialUsername,
  initialAvatarUrl,
  forceWelcome = false,
  onCompleted,
}: OnboardingShellProps) {
  const [step, setStep] = useState<Step>(forceWelcome ? "welcome" : "profile")
  const [fullName, setFullName] = useState("")
  const [username, setUsername] = useState(initialUsername)
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setStep(forceWelcome ? "welcome" : "profile")
    setFullName("")
    setUsername(initialUsername)
    setAvatarUrl(initialAvatarUrl)
    setError(null)
    setLoading(false)
  }, [initialUsername, initialAvatarUrl, forceWelcome])

  const steps = useMemo(
    () =>
      forceWelcome
        ? ([
            { key: "welcome", label: "Bienvenue" },
            { key: "profile", label: "Profil" },
            { key: "avatar", label: "Avatar" },
          ] as const)
        : ([
            { key: "profile", label: "Profil" },
            { key: "avatar", label: "Avatar" },
          ] as const),
    [forceWelcome]
  )

  const currentStepIndex = useMemo(
    () => steps.findIndex((candidate) => candidate.key === step),
    [step, steps]
  )

  const stepNumber = `${Math.max(1, currentStepIndex + 1)} / ${steps.length}`

  const submitProfile = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/onboarding/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, username }),
      })
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null
      if (!response.ok || !payload?.ok) {
        setError(payload?.error ?? "Unable to save profile.")
        return
      }
      setStep("avatar")
    } catch {
      setError("Unable to save profile.")
    } finally {
      setLoading(false)
    }
  }

  const finalizeAvatar = async (skip: boolean) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/onboarding/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skip,
          avatarUrl: skip ? null : avatarUrl.trim(),
        }),
      })
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null
      if (!response.ok || !payload?.ok) {
        setError(payload?.error ?? "Unable to complete onboarding.")
        return
      }
      onCompleted()
    } catch {
      setError("Unable to complete onboarding.")
    } finally {
      setLoading(false)
    }
  }

  const goBack = () => {
    if (step === "avatar") {
      setStep("profile")
      return
    }
    if (step === "profile" && forceWelcome) {
      setStep("welcome")
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-background via-muted/20 to-background text-foreground">
      <div className="flex h-full min-h-0 flex-col bg-gradient-to-b from-background via-muted/20 to-background">
          <div className="bg-background/95 px-6 py-4 backdrop-blur">
            <div className="mx-auto flex w-full max-w-5xl items-center gap-4">
              <div className="w-24">
                {currentStepIndex > 0 ? (
                  <Button type="button" variant="outline" size="sm" onClick={goBack} className="gap-1.5">
                    <ArrowLeft className="size-4" />
                    Retour
                  </Button>
                ) : null}
              </div>
              <div className="flex-1">
                <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  <span>Onboarding</span>
                  <span>{stepNumber}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {steps.map((item, index) => {
                    const active = index <= currentStepIndex
                    return (
                      <div
                        key={item.key}
                        className={active ? "h-1.5 rounded-full bg-primary" : "h-1.5 rounded-full bg-muted"}
                        title={item.label}
                      />
                    )
                  })}
                </div>
              </div>
              <div className="w-24" />
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center px-6 py-8">
            {step === "welcome" ? (
              <div className="relative w-full space-y-6 overflow-hidden p-2 md:p-4">
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  {Array.from({ length: 36 }).map((_, index) => (
                    <span
                      key={index}
                      className="confetti-piece absolute -top-6 block h-2.5 w-1.5 rounded-full"
                      style={{
                        left: `${(index * 97) % 100}%`,
                        animationDelay: `${(index % 12) * 0.22}s`,
                        animationDuration: `${4.4 + (index % 5) * 0.35}s`,
                        backgroundColor: ["#f97316", "#22c55e", "#facc15", "#ffffff", "#3b82f6"][index % 5],
                        transform: `rotate(${(index * 41) % 360}deg)`,
                      }}
                    />
                  ))}
                </div>

                <div className="relative space-y-2 text-center">
                  <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Sparkles className="size-5" />
                  </div>
                <h2 className="text-3xl font-bold tracking-tight text-foreground">Bienvenue sur FOROM</h2>
                <p className="mx-auto max-w-xl text-sm text-muted-foreground">
                Voici les deux concepts cles : les propositions et les pages.
              </p>
            </div>

              <div className="relative grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border bg-background p-4 text-center">
                  <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <LightbulbIcon />
                </div>
                  <p className="text-base font-semibold text-foreground">Les propositions</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                  Cree une idee, fais voter la communaute et fais avancer les sujets.
                </p>
              </div>
                <div className="rounded-xl border bg-background p-4 text-center">
                  <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="size-4" />
                </div>
                  <p className="text-base font-semibold text-foreground">Les pages</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                  Regroupe les propositions par theme, projet ou communaute.
                </p>
              </div>
            </div>

              <div className="relative flex justify-end">
                <Button type="button" onClick={() => setStep("profile")} className="h-11 min-w-36 text-base font-semibold">
                  Commencer
                </Button>
              </div>
            </div>
            ) : step === "profile" ? (
              <div className="w-full max-w-2xl p-2 md:p-4">
                <OnboardingProfileStep
                  fullName={fullName}
                  username={username}
                  loading={loading}
                  error={error}
                  onFullNameChange={setFullName}
                  onUsernameChange={setUsername}
                  onSubmit={() => void submitProfile()}
                />
              </div>
            ) : (
              <div className="w-full max-w-2xl p-2 md:p-4">
                <OnboardingAvatarStep
                  avatarUrl={avatarUrl}
                  loading={loading}
                  error={error}
                  onAvatarUrlChange={setAvatarUrl}
                  onSubmitAvatar={() => void finalizeAvatar(false)}
                  onSkip={() => void finalizeAvatar(true)}
                />
              </div>
            )}
          </div>
      </div>
      <style jsx>{`
        .confetti-piece {
          opacity: 0;
          animation-name: confetti-fall;
          animation-iteration-count: 1;
          animation-timing-function: linear;
        }
        @keyframes confetti-fall {
          0% {
            opacity: 0;
            transform: translateY(-12px) rotate(0deg);
          }
          10% {
            opacity: 1;
          }
          100% {
            opacity: 0.9;
            transform: translateY(360px) rotate(520deg);
          }
        }
      `}</style>
    </div>
  )
}

function LightbulbIcon() {
  return <Lightbulb className="size-4" />
}
