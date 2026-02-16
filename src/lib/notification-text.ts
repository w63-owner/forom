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
  solution_marked: "notificationBody_solutionMarked",
  solution_unmarked: "notificationBody_solutionUnmarked",
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

