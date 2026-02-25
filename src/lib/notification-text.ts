import { relativeTime } from "@/lib/utils"

type NotificationLike = {
  type?: string | null
  body?: string | null
}

const LEGACY_BODY_MAP: Record<string, string> = {
  "A new comment was posted for your proposition.":
    "notificationBody_commentCreated",
  "A new volunteer joined your proposition.":
    "notificationBody_volunteerCreated",
  "Your proposition status changed to Done.":
    "notificationBody_statusDoneAuthor",
  "A proposition linked to this page was marked as done.":
    "notificationBody_statusDoneSubscriber",
  "Your comment was marked as a solution.":
    "notificationBody_solutionMarked",
  "Your comment is no longer marked as a solution.":
    "notificationBody_solutionUnmarked",
}

const TYPE_MAP: Record<string, string> = {
  comment_created: "notificationBody_commentCreated",
  volunteer_created: "notificationBody_volunteerCreated",
  status_done: "notificationBody_statusDoneSubscriber",
  status_change: "notificationBody_statusChange",
  solution_marked: "notificationBody_solutionMarked",
  solution_unmarked: "notificationBody_solutionUnmarked",
  page_parent_request: "notificationBody_pageParentRequest",
  proposition_created_linked: "notificationBody_propositionCreatedLinked",
}

export function getLocalizedNotificationBody(
  notification: NotificationLike,
  t: (key: string) => string
): string | null {
  const typeKey = notification.type ? TYPE_MAP[notification.type] : undefined
  if (typeKey) {
    return t(typeKey)
  }

  const body = notification.body?.trim() ?? ""
  if (!body) return null

  const legacyKey = LEGACY_BODY_MAP[body]
  if (legacyKey) return t(legacyKey)

  return body
}

export function formatNotificationAge(dateStr: string, locale: string): string {
  if (locale.startsWith("en")) {
    const createdAtDate = new Date(dateStr)
    const createdAt = createdAtDate.getTime()
    const nowDate = new Date()
    const now = nowDate.getTime()
    const diffSeconds = Math.max(0, Math.round((now - createdAt) / 1000))
    if (diffSeconds < 60) return "just now"
    const minutes = Math.round(diffSeconds / 60)
    if (minutes < 60) return `${minutes}mn ago`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.round(hours / 24)
    if (days < 7) return `${days}d ago`
    if (createdAtDate.getFullYear() !== nowDate.getFullYear()) {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(createdAtDate)
    }
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(createdAtDate)
  }
  return relativeTime(dateStr, locale)
}

