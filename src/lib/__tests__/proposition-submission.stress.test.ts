import { describe, it, expect } from "vitest"
import {
  sanitizeQuery,
  stripHtml,
  isDuplicatePropositionError,
  canSubmitProposition,
} from "@/lib/proposition-submission"

describe("proposition-submission - stress", () => {
  it("stress: 1000 sequential sanitizeQuery calls with mixed input", () => {
    const inputs = ["hello", "100%", "a_b", "%_%", "no escape", ""]
    for (let i = 0; i < 1000; i++) {
      const s = inputs[i % inputs.length]!
      const out = sanitizeQuery(s)
      expect(typeof out).toBe("string")
      expect(out).not.toMatch(/(?<!\\)[%_]/)
    }
  })

  it("stress: 1000 sequential stripHtml calls", () => {
    const inputs = [
      "<p>text</p>",
      "plain",
      "<div><span>nested</span></div>",
      "",
      "  <b>x</b>  ",
    ]
    for (let i = 0; i < 1000; i++) {
      const s = inputs[i % inputs.length]!
      const out = stripHtml(s)
      expect(typeof out).toBe("string")
      expect(out).not.toMatch(/<[^>]+>/)
    }
  })

  it("stress: 500 concurrent canSubmitProposition calls", async () => {
    const cases: [string, "none" | "existing" | "create", boolean][] = [
      ["", "none", false],
      ["T", "none", false],
      ["T", "existing", false],
      ["T", "existing", true],
      ["T", "create", false],
    ]
    const promises = Array.from({ length: 100 }, () =>
      Promise.all(
        cases.map(([t, l, p]) => Promise.resolve(canSubmitProposition(t, l, p)))
      )
    )
    const results = await Promise.all(promises)
    expect(results.flat()).toHaveLength(500)
    expect(results.flat().every((b) => typeof b === "boolean")).toBe(true)
  })

  it("stress: isDuplicatePropositionError 500 rapid calls", () => {
    const errors = [
      { code: "23505" },
      { message: "unique" },
      { message: "duplicate" },
      { code: "22P02" },
      null,
    ]
    for (let i = 0; i < 500; i++) {
      const e = errors[i % errors.length]
      const r = isDuplicatePropositionError(e as { code?: string; message?: string } | null)
      expect(typeof r).toBe("boolean")
    }
  })
})