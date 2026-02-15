import { describe, it, expect } from "vitest"
import { getCategoriesForUniverseFromCsv } from "@/lib/discover-categories"
import { UNIVERSE_SLUGS } from "@/types/schema"
import type { Universe } from "@/types/schema"

const universes = Object.keys(UNIVERSE_SLUGS) as Universe[]

describe("discover-categories - stress", () => {
  it("stress: 500 concurrent getCategoriesForUniverseFromCsv calls return consistent data", async () => {
    const concurrency = 500
    const perUniverse = Math.ceil(concurrency / universes.length)
    const promises = universes.flatMap((u) =>
      Array.from({ length: perUniverse }, () =>
        Promise.resolve(getCategoriesForUniverseFromCsv(u))
      )
    )
    const results = await Promise.all(promises)
    expect(results.length).toBeGreaterThanOrEqual(concurrency)
    for (let i = 0; i < universes.length; i++) {
      const u = universes[i]!
      const sample = getCategoriesForUniverseFromCsv(u)
      const firstResultForUniverse = results[i * perUniverse]
      expect(sample).toHaveLength(firstResultForUniverse?.length ?? 0)
      expect(JSON.stringify(sample)).toBe(JSON.stringify(firstResultForUniverse))
    }
  })

  it("stress: 1000 sequential getCategoriesForUniverseFromCsv calls (all universes)", () => {
    const iterations = 1000
    for (let i = 0; i < iterations; i++) {
      const u = universes[i % universes.length]!
      const cats = getCategoriesForUniverseFromCsv(u)
      expect(Array.isArray(cats)).toBe(true)
      expect(cats.every((c) => c.category && Array.isArray(c.subCategories))).toBe(true)
    }
  })
})