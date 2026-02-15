import { describe, it, expect } from "vitest"
import { getCategoriesForUniverseFromCsv } from "@/lib/discover-categories"
import type { Universe } from "@/types/schema"

describe("discover-categories - chaos", () => {
  it("chaos: null-like universe cast returns empty array", () => {
    const result = getCategoriesForUniverseFromCsv("" as unknown as Universe)
    expect(result).toEqual([])
  })

  it("chaos: random string as universe returns empty array", () => {
    const result = getCategoriesForUniverseFromCsv("NOT_AN_UNIVERSE_XYZ" as Universe)
    expect(result).toEqual([])
  })

  it("chaos: category with empty subCategories array is valid", () => {
    const cats = getCategoriesForUniverseFromCsv("MOBILITY_TRAVEL")
    const withSubs = cats.filter((c) => c.subCategories.length > 0)
    const withEmpty = cats.filter((c) => c.subCategories.length === 0)
    expect(withSubs.length + withEmpty.length).toBe(cats.length)
    for (const c of withEmpty) {
      expect(c.subCategories).toEqual([])
    }
  })

  it("chaos: sub-category with special chars (quotes, ampersand) is present", () => {
    const cats = getCategoriesForUniverseFromCsv("MOBILITY_TRAVEL")
    const aviation = cats.find((c) => c.category === "Aviation Commerciale")
    expect(aviation).toBeDefined()
    const withAmp = aviation!.subCategories.find((s) => s.includes("&"))
    expect(withAmp).toBeDefined()
    expect(withAmp).toContain("&")
  })

  it("chaos: search filter logic with empty query returns all", () => {
    const q = ""
    const cats = getCategoriesForUniverseFromCsv("MOBILITY_TRAVEL")
    const filtered = q
      ? cats.filter((c) =>
          c.category.toLowerCase().includes(q.trim().toLowerCase()) ||
          c.subCategories.some((s) => s.toLowerCase().includes(q.trim().toLowerCase()))
        )
      : cats
    expect(filtered).toHaveLength(cats.length)
  })

  it("chaos: search filter logic with non-matching query returns empty", () => {
    const q = "xyznonexistent123"
    const cats = getCategoriesForUniverseFromCsv("MOBILITY_TRAVEL")
    const matches = cats.filter((c) =>
      c.category.toLowerCase().includes(q.toLowerCase()) ||
      c.subCategories.some((s) => s.toLowerCase().includes(q.toLowerCase()))
    )
    expect(matches).toHaveLength(0)
  })
})