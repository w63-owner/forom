import { describe, expect, it, vi } from "vitest"
import {
  getLocalizedNotificationBody,
  formatNotificationAge,
} from "@/lib/notification-text"

describe("getLocalizedNotificationBody", () => {
  const mockT = (key: string) => `[translated:${key}]`

  it("returns translated body for known notification type", () => {
    const result = getLocalizedNotificationBody(
      { type: "comment_created", body: null },
      mockT
    )
    expect(result).toBe("[translated:notificationBody_commentCreated]")
  })

  it("maps all known types to their i18n key", () => {
    const types = [
      ["comment_created", "notificationBody_commentCreated"],
      ["volunteer_created", "notificationBody_volunteerCreated"],
      ["status_done", "notificationBody_statusDoneSubscriber"],
      ["status_change", "notificationBody_statusChange"],
      ["solution_marked", "notificationBody_solutionMarked"],
      ["solution_unmarked", "notificationBody_solutionUnmarked"],
      ["page_parent_request", "notificationBody_pageParentRequest"],
      [
        "proposition_created_linked",
        "notificationBody_propositionCreatedLinked",
      ],
    ] as const

    for (const [type, expectedKey] of types) {
      const result = getLocalizedNotificationBody({ type, body: null }, mockT)
      expect(result).toBe(`[translated:${expectedKey}]`)
    }
  })

  it("falls back to legacy body map for known English body text", () => {
    const result = getLocalizedNotificationBody(
      {
        type: null,
        body: "A new comment was posted for your proposition.",
      },
      mockT
    )
    expect(result).toBe("[translated:notificationBody_commentCreated]")
  })

  it("falls back to body when type is unknown and body is not legacy", () => {
    const result = getLocalizedNotificationBody(
      { type: "unknown_type", body: "Custom body text" },
      mockT
    )
    expect(result).toBe("Custom body text")
  })

  it("returns null for null/undefined type and empty body", () => {
    expect(
      getLocalizedNotificationBody({ type: null, body: null }, mockT)
    ).toBeNull()
    expect(
      getLocalizedNotificationBody({ type: null, body: "" }, mockT)
    ).toBeNull()
    expect(
      getLocalizedNotificationBody({ type: null, body: "   " }, mockT)
    ).toBeNull()
  })

  it("returns raw body when type is null and body is non-legacy", () => {
    const result = getLocalizedNotificationBody(
      { type: null, body: "Some custom text" },
      mockT
    )
    expect(result).toBe("Some custom text")
  })

  it("handles legacy body for solution_unmarked", () => {
    const result = getLocalizedNotificationBody(
      {
        type: null,
        body: "Your comment is no longer marked as a solution.",
      },
      mockT
    )
    expect(result).toBe("[translated:notificationBody_solutionUnmarked]")
  })

  it("prefers type mapping over body text when type is present", () => {
    const result = getLocalizedNotificationBody(
      {
        type: "comment_created",
        body: "A new volunteer joined your proposition.",
      },
      mockT
    )
    expect(result).toBe("[translated:notificationBody_commentCreated]")
  })
})

describe("formatNotificationAge", () => {
  it("returns 'just now' for a date less than 60 seconds ago (en)", () => {
    const now = new Date()
    expect(formatNotificationAge(now.toISOString(), "en")).toBe("just now")
  })

  it("returns minutes ago for dates within the hour (en)", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
    expect(formatNotificationAge(fiveMinAgo.toISOString(), "en")).toBe(
      "5mn ago"
    )
  })

  it("returns hours ago for dates within the day (en)", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000)
    expect(formatNotificationAge(threeHoursAgo.toISOString(), "en")).toBe(
      "3h ago"
    )
  })

  it("returns days ago for dates within the week (en)", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    expect(formatNotificationAge(twoDaysAgo.toISOString(), "en")).toBe(
      "2d ago"
    )
  })

  it("returns formatted date for dates older than a week (en, same year)", () => {
    const now = new Date()
    const oldDate = new Date(now.getFullYear(), 0, 15)
    if (now.getTime() - oldDate.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return
    }
    const result = formatNotificationAge(oldDate.toISOString(), "en")
    expect(result).toContain("Jan")
    expect(result).toContain("15")
  })

  it("includes year for dates from a different year (en)", () => {
    const oldDate = new Date(2023, 5, 20)
    const result = formatNotificationAge(oldDate.toISOString(), "en")
    expect(result).toContain("2023")
    expect(result).toContain("Jun")
  })

  it("uses relativeTime for French locale", () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const result = formatNotificationAge(oneHourAgo.toISOString(), "fr")
    expect(typeof result).toBe("string")
    expect(result.length).toBeGreaterThan(0)
  })

  it("handles future dates gracefully (en)", () => {
    const future = new Date(Date.now() + 60 * 1000)
    const result = formatNotificationAge(future.toISOString(), "en")
    expect(result).toBe("just now")
  })
})
