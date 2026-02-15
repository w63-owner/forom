import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function relativeTime(dateStr: string, locale = "en"): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffSeconds = Math.round((d.getTime() - now.getTime()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })

  const absSeconds = Math.abs(diffSeconds)
  if (absSeconds < 60) return rtf.format(diffSeconds, "second")

  const diffMinutes = Math.round(diffSeconds / 60)
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, "minute")

  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, "hour")

  const diffDays = Math.round(diffHours / 24)
  if (Math.abs(diffDays) < 7) return rtf.format(diffDays, "day")

  const diffWeeks = Math.round(diffDays / 7)
  if (Math.abs(diffWeeks) < 4) return rtf.format(diffWeeks, "week")

  const diffMonths = Math.round(diffDays / 30)
  if (Math.abs(diffMonths) < 12) return rtf.format(diffMonths, "month")

  const diffYears = Math.round(diffDays / 365)
  return rtf.format(diffYears, "year")
}