"use client"

import { Camera, Upload } from "lucide-react"
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

const DEFAULT_AVATARS = [
  "https://api.dicebear.com/9.x/adventurer/svg?seed=A",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=B",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=C",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=D",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=E",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=F",
]

export function OnboardingAvatarStep({
  avatarUrl,
  loading,
  error,
  onAvatarUrlChange,
  onSubmitAvatar,
  onSkip,
}: OnboardingAvatarStepProps) {
  const avatarInitial = (avatarUrl.trim().slice(-1) || "A").toUpperCase()
  const hasSelectedAvatar = avatarUrl.trim().length > 0

  return (
    <div className="space-y-7">
      <div className="space-y-2 text-center">
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Camera className="size-5" />
        </div>
        <h2 className="text-4xl font-bold tracking-tight text-foreground">Add Your Photo</h2>
        <p className="text-base text-muted-foreground">Choose an avatar or upload your own</p>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-dashed bg-background p-8">
          <div className="space-y-3 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-border bg-muted text-xl font-semibold text-muted-foreground">
              {avatarInitial}
            </div>
            <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
              <Upload className="size-4" />
              Drag & drop or click to upload
            </p>
            <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 5MB</p>
          </div>
        </div>
      </div>

      <p className="text-center text-sm text-muted-foreground">Or choose a default avatar</p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {DEFAULT_AVATARS.map((url) => {
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
              <img src={url} alt="Default avatar option" className="size-full object-cover" />
            </button>
          )
        })}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        You can always add a photo later in your settings
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        {hasSelectedAvatar ? (
          <Button type="button" onClick={onSubmitAvatar} disabled={loading}>
            {loading ? "Saving..." : "Finish"}
          </Button>
        ) : (
          <Button type="button" variant="ghost" onClick={onSkip} disabled={loading}>
            {loading ? "Loading..." : "Skip for now"}
          </Button>
        )}
      </div>
    </div>
  )
}
