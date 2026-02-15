import { describe, it, expect } from "vitest"
import {
  sanitizeQuery,
  stripHtml,
  isDuplicatePropositionError,
  canSubmitProposition,
} from "@/lib/proposition-submission"

describe("proposition-submission - chaos", () => {
  describe("sanitizeQuery chaos", () => {
    it("chaos: XSS-like input does not break", () => {
      const xss = "<script>alert(1)</script>%"
      expect(sanitizeQuery(xss)).toContain("\\%")
      expect(sanitizeQuery(xss)).toBe("<script>alert(1)</script>\\%")
    })

    it("chaos: SQL injection patterns escaped", () => {
      expect(sanitizeQuery("' OR 1=1 --")).toBe("' OR 1=1 --")
      expect(sanitizeQuery("%' OR '1'='1")).toContain("\\%")
    })

    it("chaos: unicode and emoji", () => {
      expect(sanitizeQuery("café_100%")).toBe("café\\_100\\%")
      expect(sanitizeQuery("🚀%")).toBe("🚀\\%")
    })

    it("chaos: very long string", () => {
      const long = "a".repeat(10000) + "%_%"
      const out = sanitizeQuery(long)
      // "%_%" becomes "\\%\\_\\%" = 6 chars (was 3)
      expect(out.length).toBe(10000 + 6)
      expect(out.endsWith("\\%\\_\\%")).toBe(true)
    })

    it("chaos: only special chars", () => {
      expect(sanitizeQuery("%%%")).toBe("\\%\\%\\%")
    })
  })

  describe("stripHtml chaos", () => {
    it("chaos: script tags stripped", () => {
      expect(stripHtml("<script>evil()</script>hello")).toBe("evil()hello")
    })

    it("chaos: malformed tags", () => {
      expect(stripHtml("<p>unclosed")).toBe("unclosed")
      expect(stripHtml("</p>orphan")).toBe("orphan")
    })

    it("chaos: nested complex HTML", () => {
      const html = "<div><p><span class='x'>a</span></p></div>"
      expect(stripHtml(html)).toBe("a")
    })

    it("chaos: empty and null-like", () => {
      expect(stripHtml("")).toBe("")
    })

    it("chaos: only tags", () => {
      expect(stripHtml("<br/><hr/>")).toBe("")
    })
  })

  describe("isDuplicatePropositionError chaos", () => {
    it("chaos: undefined and empty object", () => {
      expect(isDuplicatePropositionError(undefined as unknown as null)).toBe(false)
      expect(isDuplicatePropositionError({})).toBe(false)
    })

    it("chaos: message case insensitive", () => {
      expect(isDuplicatePropositionError({ message: "UNIQUE constraint" })).toBe(true)
      expect(isDuplicatePropositionError({ message: "DUPLICATE key" })).toBe(true)
    })
  })

  describe("canSubmitProposition chaos", () => {
    it("chaos: whitespace-only title", () => {
      expect(canSubmitProposition("\n\t ", "none", false)).toBe(false)
    })

    it("chaos: single char title", () => {
      expect(canSubmitProposition("a", "none", false)).toBe(true)
    })

    it("chaos: existing + no page = false", () => {
      expect(canSubmitProposition("Good title", "existing", false)).toBe(false)
    })
  })
})