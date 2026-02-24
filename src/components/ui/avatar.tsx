"use client"

import type { CSSProperties } from "react"
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
  /** Seed optionnelle pour varier le fallback visuel (utile pour les anonymes). */
  seed?: string | null
  size?: keyof typeof sizes
  className?: string
}

const isAnonymousDisplayName = (value: string): boolean => {
  const normalized = value.toLowerCase().trim().replace(/\s+/g, " ")
  return normalized === "anonymous" || normalized === "anonyme"
}

const anonymousStyleFromSeed = (seed: string): CSSProperties => {
  const base = hashString(seed || "anonymous-seed")
  const hueA = base % 360
  const hueB = (base * 37) % 360
  return {
    backgroundImage: `linear-gradient(135deg, hsl(${hueA} 80% 92%), hsl(${hueB} 75% 84%))`,
    color: `hsl(${(hueA + 190) % 360} 42% 26%)`,
  }
}

export function Avatar({ src, name, seed, size = "md", className }: AvatarProps) {
  const displayName = (name || "?").trim() || "?"
  const initials = displayName.slice(0, 2).toUpperCase()
  const colorClass = AVATAR_COLORS[getAvatarColorIndex(displayName)]
  const isAnonymous = isAnonymousDisplayName(displayName) && !src
  const anonymousStyle = isAnonymous
    ? anonymousStyleFromSeed(seed?.trim() || displayName)
    : undefined

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full border-2 border-card font-medium flex items-center justify-center",
        sizes[size],
        !src && !isAnonymous && colorClass,
        className
      )}
      style={anonymousStyle}
    >
      {src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            className="h-full w-full object-cover"
          />
        </>
      ) : isAnonymous ? (
        <svg
          viewBox="0 0 24 24"
          className="h-[65%] w-[65%]"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="12" cy="8" r="3.5" fill="currentColor" opacity="0.9" />
          <path
            d="M5.5 19c0-3.2 2.9-5.8 6.5-5.8s6.5 2.6 6.5 5.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.9"
          />
        </svg>
      ) : (
        <span>{initials}</span>
      )}
    </div>
  )
}