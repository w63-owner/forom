import { describe, expect, it } from "vitest"

type SearchPage = { id: string; visibility: "public" | "private" }

function filterDiscoverablePages(input: SearchPage[]) {
  return input.filter((page) => page.visibility === "public")
}

describe("private pages search filtering stress", () => {
  it("keeps only public pages at scale", () => {
    const data: SearchPage[] = Array.from({ length: 3000 }, (_, i) => ({
      id: `page-${i}`,
      visibility: i % 7 === 0 ? "private" : "public",
    }))
    const result = filterDiscoverablePages(data)
    expect(result.every((page) => page.visibility === "public")).toBe(true)
    expect(result.length).toBeLessThan(data.length)
  })
})

