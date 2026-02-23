import { describe, expect, it } from "vitest"
import { isProtectedAppPath, stripLocalePrefix } from "@/lib/security/protected-routes"

describe("protected route matching", () => {
  it("marks edit and create routes as protected", () => {
    expect(isProtectedAppPath("/profile")).toBe(true)
    expect(isProtectedAppPath("/pages/create")).toBe(true)
    expect(isProtectedAppPath("/propositions/create")).toBe(true)
    expect(isProtectedAppPath("/propositions/abc/edit")).toBe(true)
  })

  it("keeps public routes unprotected", () => {
    expect(isProtectedAppPath("/")).toBe(false)
    expect(isProtectedAppPath("/discover")).toBe(false)
  })

  it("strips locale prefixes", () => {
    const result = stripLocalePrefix("/fr/propositions/create")
    expect(result.locale).toBe("fr")
    expect(result.normalizedPath).toBe("/propositions/create")
  })
})
