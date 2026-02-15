import { describe, it, expect } from "vitest"
import {
  sanitizeQuery,
  stripHtml,
  isDuplicatePropositionError,
  canSubmitProposition,
} from "@/lib/proposition-submission"

describe("proposition-submission - QA", () => {
  describe("sanitizeQuery", () => {
    it("QA: escapes % and _ for ilike patterns", () => {
      expect(sanitizeQuery("hello")).toBe("hello")
      expect(sanitizeQuery("100%")).toBe("100\\%")
      expect(sanitizeQuery("foo_bar")).toBe("foo\\_bar")
      expect(sanitizeQuery("%_%")).toBe("\\%\\_\\%")
    })

    it("QA: empty string returns empty", () => {
      expect(sanitizeQuery("")).toBe("")
    })

    it("QA: no special chars returns unchanged", () => {
      expect(sanitizeQuery("Proposition claire")).toBe("Proposition claire")
    })
  })

  describe("stripHtml", () => {
    it("QA: removes HTML tags and trims", () => {
      expect(stripHtml("<p>Hello</p>")).toBe("Hello")
      expect(stripHtml("  <b>bold</b>  ")).toBe("bold")
      expect(stripHtml("<div><span>nested</span></div>")).toBe("nested")
    })

    it("QA: empty or whitespace-only HTML", () => {
      expect(stripHtml("<p></p>")).toBe("")
      expect(stripHtml("   ")).toBe("")
    })

    it("QA: plain text unchanged", () => {
      expect(stripHtml("No tags here")).toBe("No tags here")
    })
  })

  describe("isDuplicatePropositionError", () => {
    it("QA: code 23505 is duplicate", () => {
      expect(isDuplicatePropositionError({ code: "23505" })).toBe(true)
    })

    it("QA: message contains 'unique' is duplicate", () => {
      expect(isDuplicatePropositionError({ message: "unique constraint violated" })).toBe(true)
    })

    it("QA: message contains 'duplicate' is duplicate", () => {
      expect(isDuplicatePropositionError({ message: "Duplicate key" })).toBe(true)
    })

    it("QA: other errors not duplicate", () => {
      expect(isDuplicatePropositionError({ code: "22P02", message: "invalid input" })).toBe(false)
      expect(isDuplicatePropositionError(null)).toBe(false)
    })
  })

  describe("canSubmitProposition", () => {
    it("QA: requires non-empty trimmed title", () => {
      expect(canSubmitProposition("", "none", false)).toBe(false)
      expect(canSubmitProposition("   ", "none", false)).toBe(false)
      expect(canSubmitProposition("Valid", "none", false)).toBe(true)
    })

    it("QA: linkChoice none allows submit without page", () => {
      expect(canSubmitProposition("Title", "none", false)).toBe(true)
    })

    it("QA: linkChoice existing requires selected page", () => {
      expect(canSubmitProposition("Title", "existing", false)).toBe(false)
      expect(canSubmitProposition("Title", "existing", true)).toBe(true)
    })

    it("QA: linkChoice create allows submit", () => {
      expect(canSubmitProposition("Title", "create", false)).toBe(true)
    })
  })
})