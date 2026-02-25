import { describe, expect, it } from "vitest"
import {
  getLocalizedNotificationBody,
  formatNotificationAge,
} from "@/lib/notification-text"

describe("getLocalizedNotificationBody - stress", () => {
  const mockT = (key: string) => `[t:${key}]`

  it("handles 1000 notifications with mixed types without error", () => {
    const types = [
      "comment_created",
      "volunteer_created",
      "status_done",
      "status_change",
      "solution_marked",
      "solution_unmarked",
      "page_parent_request",
      "proposition_created_linked",
      null,
      "unknown_type",
    ]

    for (let i = 0; i < 1000; i++) {
      const type = types[i % types.length]
      const body =
        i % 3 === 0
          ? "A new comment was posted for your proposition."
          : i % 3 === 1
            ? `Custom body ${i}`
            : null
      const result = getLocalizedNotificationBody({ type, body }, mockT)
      expect(typeof result === "string" || result === null).toBe(true)
    }
  })

  it("handles empty/whitespace-only bodies consistently", () => {
    const bodies = ["", " ", "  \n\t  ", null]
    for (const body of bodies) {
      const result = getLocalizedNotificationBody(
        { type: null, body },
        mockT
      )
      expect(result).toBeNull()
    }
  })
})

describe("formatNotificationAge - stress", () => {
  it("handles 500 random dates without throwing (en)", () => {
    const now = Date.now()
    for (let i = 0; i < 500; i++) {
      const offset = Math.random() * 365 * 24 * 60 * 60 * 1000
      const date = new Date(now - offset)
      const result = formatNotificationAge(date.toISOString(), "en")
      expect(typeof result).toBe("string")
      expect(result.length).toBeGreaterThan(0)
    }
  })

  it("handles 500 random dates without throwing (fr)", () => {
    const now = Date.now()
    for (let i = 0; i < 500; i++) {
      const offset = Math.random() * 365 * 24 * 60 * 60 * 1000
      const date = new Date(now - offset)
      const result = formatNotificationAge(date.toISOString(), "fr")
      expect(typeof result).toBe("string")
      expect(result.length).toBeGreaterThan(0)
    }
  })

  it("boundary: exactly 60 seconds ago returns minutes (en)", () => {
    const date = new Date(Date.now() - 60 * 1000)
    const result = formatNotificationAge(date.toISOString(), "en")
    expect(result).toBe("1mn ago")
  })

  it("boundary: exactly 24 hours ago returns days (en)", () => {
    const date = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const result = formatNotificationAge(date.toISOString(), "en")
    expect(result).toBe("1d ago")
  })
})
