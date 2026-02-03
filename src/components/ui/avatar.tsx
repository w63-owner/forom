"use client"

import { cn } from "@/lib/utils"

/** Couleur de fond dérivée du pseudo (cohérent avec la DA). */
const AVATAR_COLORS = [
  "bg-primary/20 text-primary",
  "bg-chart-1/25 text-chart-1",
  "bg-chart-2/25 text-chart-2",
  "bg-chart-3/25 text-chart-3",
  "bg-chart-4/25 text-chart-4",
  "bg-chart-5/25 text-chart-5",
  "bg-accent text-accent-foreground",
  "bg-secondary text-secondary-foreground",
] as const

function hashString(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

function getAvatarColorIndex(name: string): number {
  return hashString(name || "?") % AVATAR_COLORS.length
}

const sizes = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
} as const

type AvatarProps = {
  /** URL de l'image (si fournie, affichée à la place des initiales). */
  src?: string | null
  /** Pseudo ou email pour les initiales (2 premières lettres) et la couleur de fond. */
  name?: string | null
  size?: keyof typeof sizes
  className?: string
}

export function Avatar({ src, name, size = "md", className }: AvatarProps) {
  const displayName = (name || "?").trim() || "?"
  const initials = displayName.slice(0, 2).toUpperCase()
  const colorClass = AVATAR_COLORS[getAvatarColorIndex(displayName)]

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full border-2 border-card font-medium flex items-center justify-center",
        sizes[size],
        !src && colorClass,
        className
      )}
    >
      {src ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  )
}
