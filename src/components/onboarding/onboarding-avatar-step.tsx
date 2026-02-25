"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Camera, RefreshCw, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type OnboardingAvatarStepProps = {
  avatarUrl: string
  loading: boolean
  error: string | null
  onAvatarUrlChange: (value: string) => void
  onSubmitAvatar: () => void
  onSkip: () => void
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

function randomSeed(): string {
  const len = Math.floor(Math.random() * 3) + 1
  let seed = ""
  for (let i = 0; i < len; i += 1) {
    seed += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return seed
}

function buildRandomAvatars(count = 7): string[] {
  const seeds = new Set<string>()
  while (seeds.size < count) {
    seeds.add(randomSeed())
  }
  return Array.from(seeds).map(
    (seed) => `https://api.dicebear.com/9.x/adventurer/svg?seed=${seed}`
  )
}

export function OnboardingAvatarStep({
  avatarUrl,
  loading,
  error,
  onAvatarUrlChange,
  onSubmitAvatar,
  onSkip,
}: OnboardingAvatarStepProps) {
  const t = useTranslations("OnboardingAvatar")
  const avatarInitial = (avatarUrl.trim().slice(-1) || "A").toUpperCase()
  const hasSelectedAvatar = avatarUrl.trim().length > 0
  const [avatarOptions, setAvatarOptions] = useState<string[]>(() => buildRandomAvatars())
  const [refreshTick, setRefreshTick] = useState(0)
  const refreshing = useMemo(() => refreshTick > 0, [refreshTick])

  const regenerateAvatars = () => {
    setRefreshTick((v) => v + 1)
    setAvatarOptions(buildRandomAvatars())
    setTimeout(() => setRefreshTick(0), 500)
  }

  return (
    <div className="space-y-7">
      <div className="space-y-2 text-center">
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Camera className="size-5" />
        </div>
        <h2 className="text-4xl font-bold tracking-tight text-foreground">{t("title")}</h2>
        <p className="text-base text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-dashed bg-background p-8">
          <div className="space-y-3 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-border bg-muted text-xl font-semibold text-muted-foreground">
              {avatarInitial}
            </div>
            <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
              <Upload className="size-4" />
              {t("uploadCta")}
            </p>
            <p className="text-xs text-muted-foreground">{t("uploadHint")}</p>
          </div>
        </div>
      </div>

      <p className="text-center text-sm text-muted-foreground">{t("defaultAvatarTitle")}</p>

      <div className="mx-auto grid w-fit grid-cols-4 justify-items-center gap-2.5 md:flex md:flex-wrap md:items-center md:justify-center md:gap-3">
        {avatarOptions.map((url) => {
          const selected = avatarUrl === url
          return (
            <button
              key={url}
              type="button"
              onClick={() => onAvatarUrlChange(selected ? "" : url)}
              className={cn(
                "size-16 overflow-hidden rounded-full border-2 transition-colors",
                selected ? "border-primary" : "border-border"
              )}
            >
              <img src={url} alt={t("defaultAvatarAlt")} className="size-full object-cover" />
            </button>
          )
        })}
        <button
          type="button"
          onClick={regenerateAvatars}
          aria-label={t("rerollAria")}
          className="inline-flex size-16 items-center justify-center rounded-full border-2 border-dashed border-border bg-background text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <RefreshCw className={cn("size-6", refreshing && "animate-spin")} />
        </button>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        {t("settingsHint")}
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        {hasSelectedAvatar ? (
          <Button type="button" onClick={onSubmitAvatar} disabled={loading}>
            {loading ? t("saving") : t("finish")}
          </Button>
        ) : (
          <Button type="button" variant="ghost" onClick={onSkip} disabled={loading}>
            {loading ? t("loading") : t("skip")}
          </Button>
        )}
      </div>
    </div>
  )
}
