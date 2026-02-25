import { describe, expect, it } from "vitest"
import {
  getLocalizedNotificationBody,
  formatNotificationAge,
} from "@/lib/notification-text"

describe("getLocalizedNotificationBody - chaos", () => {
  const mockT = (key: string) => `[t:${key}]`

  it("chaos: handles undefined fields gracefully", () => {
    const result = getLocalizedNotificationBody(
      { type: undefined, body: undefined } as { type?: string | null; body?: string | null },
      mockT
    )
    expect(result).toBeNull()
  })

  it("chaos: XSS-like body text is returned as-is (sanitization is caller responsibility)", () => {
    const xssBody = '<script>alert("xss")</script>'
    const result = getLocalizedNotificationBody(
      { type: null, body: xssBody },
      mockT
    )
    expect(result).toBe(xssBody)
  })

  it("chaos: very long type string does not throw", () => {
    const longType = "a".repeat(10_000)
    const result = getLocalizedNotificationBody(
      { type: longType, body: null },
      mockT
    )
    expect(typeof result === "string" || result === null).toBe(true)
  })

  it("chaos: translator function that throws does not hide the error", () => {
    const throwingT = () => {
      throw new Error("translation service down")
    }
    expect(() =>
      getLocalizedNotificationBody(
        { type: "comment_created", body: null },
        throwingT
      )
    ).toThrow("translation service down")
  })

  it("chaos: body with only unicode zero-width chars (non-BOM) is returned raw", () => {
    const zeroWidthChars = "\u200B\u200C\u200D"
    const result = getLocalizedNotificationBody(
      { type: null, body: zeroWidthChars },
      mockT
    )
    expect(result).toBe(zeroWidthChars)
  })
})

describe("formatNotificationAge - chaos", () => {
  it("chaos: invalid date string throws (NaN propagates to Intl)", () => {
    expect(() => formatNotificationAge("not-a-date", "en")).toThrow()
  })

  it("chaos: very old date (year 1970) returns formatted date", () => {
    const result = formatNotificationAge("1970-01-01T00:00:00Z", "en")
    expect(typeof result).toBe("string")
    expect(result).toContain("1970")
  })

  it("chaos: far future date clamps to 'just now' (en)", () => {
    const future = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000)
    const result = formatNotificationAge(future.toISOString(), "en")
    expect(result).toBe("just now")
  })

  it("chaos: empty locale throws (Intl rejects invalid locales)", () => {
    const date = new Date(Date.now() - 60 * 60 * 1000)
    expect(() => formatNotificationAge(date.toISOString(), "")).toThrow()
  })
})
