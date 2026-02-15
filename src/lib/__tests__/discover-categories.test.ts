import { describe, it, expect } from "vitest"
import { getCategoriesForUniverseFromCsv } from "@/lib/discover-categories"
import { UNIVERSE_SLUGS } from "@/types/schema"
import type { Universe } from "@/types/schema"

const getCsv = getCategoriesForUniverseFromCsv
const slugs = UNIVERSE_SLUGS

describe("discover-categories - QA", () => {
  const universes = Object.keys(slugs) as Universe[]

  it("QA: all 12 universes have categories", () => {
    expect(universes).toHaveLength(12)
    for (const u of universes) {
      const cats = getCsv(u)
      expect(Array.isArray(cats)).toBe(true)
      expect(cats.length).toBeGreaterThan(0)
    }
  })

  it("QA: MOBILITY_TRAVEL has Aviation Commerciale and sub-categories", () => {
    const cats = getCsv("MOBILITY_TRAVEL")
    const aviation = cats.find((c) => c.category === "Aviation Commerciale")
    expect(aviation).toBeDefined()
    expect(aviation!.subCategories).toContain("Parcours d'enregistrement & Bagages")
    expect(aviation!.subCategories.length).toBeGreaterThanOrEqual(5)
  })

  it("QA: every category has at least one sub-category or empty array", () => {
    for (const u of universes) {
      const cats = getCsv(u)
      for (const c of cats) {
        expect(Array.isArray(c.subCategories)).toBe(true)
      }
    }
  })

  it("QA: no duplicate (universe, category) pairs", () => {
    for (const u of universes) {
      const cats = getCsv(u)
      const names = cats.map((c) => c.category)
      expect(new Set(names).size).toBe(names.length)
    }
  })

  it("QA: sub-categories within a category are unique", () => {
    for (const u of universes) {
      const cats = getCsv(u)
      for (const c of cats) {
        expect(new Set(c.subCategories).size).toBe(c.subCategories.length)
      }
    }
  })

  it("QA: unknown universe returns empty array", () => {
    const result = getCsv("UNKNOWN" as Universe)
    expect(result).toEqual([])
  })
})