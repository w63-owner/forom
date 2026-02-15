import { describe, it, expect, vi } from "vitest"
import {
  shouldSetUnauthenticatedFromServerResult,
  type ServerSessionResult,
} from "@/utils/supabase/auth-rules"

/**
 * Tests anti-faux négatifs : on ne doit passer en "déconnecté" que lorsque
 * l'API a répondu 200 avec user: null. Erreur réseau / 500 → ne pas déconnecter.
 */

describe("shouldSetUnauthenticatedFromServerResult - QA (faux négatifs)", () => {
  it("QA: ok: false (erreur réseau ou 500) → ne jamais déconnecter", () => {
    expect(
      shouldSetUnauthenticatedFromServerResult({ ok: false }, false)
    ).toBe(false)
    expect(
      shouldSetUnauthenticatedFromServerResult({ ok: false }, true)
    ).toBe(false)
  })

  it("QA: result null (timeout / pas de réponse) → ne pas déconnecter", () => {
    expect(shouldSetUnauthenticatedFromServerResult(null, false)).toBe(false)
    expect(shouldSetUnauthenticatedFromServerResult(null, true)).toBe(false)
  })

  it("QA: ok: true, user: null, hadUser: false → déconnecter (explicit logout)", () => {
    expect(
      shouldSetUnauthenticatedFromServerResult(
        { ok: true, user: null },
        false
      )
    ).toBe(true)
  })

  it("QA: ok: true, user: null, hadUser: true → ne pas déconnecter (on affiche session expirée ailleurs)", () => {
    expect(
      shouldSetUnauthenticatedFromServerResult(
        { ok: true, user: null },
        true
      )
    ).toBe(false)
  })

  it("QA: ok: true, user: {...} → ne pas déconnecter", () => {
    expect(
      shouldSetUnauthenticatedFromServerResult(
        { ok: true, user: { id: "u1", email: "a@b.com" } },
        false
      )
    ).toBe(false)
    expect(
      shouldSetUnauthenticatedFromServerResult(
        { ok: true, user: { id: "u1" } },
        true
      )
    ).toBe(false)
  })
})

describe("shouldSetUnauthenticatedFromServerResult - stress (faux négatifs)", () => {
  it("stress: 1000 appels avec ok: false → toujours false", () => {
    const result: ServerSessionResult = { ok: false }
    for (let i = 0; i < 1000; i++) {
      expect(
        shouldSetUnauthenticatedFromServerResult(result, i % 2 === 0)
      ).toBe(false)
    }
  })

  it("stress: 1000 appels avec ok: true, user: null, hadUser: true → toujours false", () => {
    const result: ServerSessionResult = { ok: true, user: null }
    for (let i = 0; i < 1000; i++) {
      expect(shouldSetUnauthenticatedFromServerResult(result, true)).toBe(false)
    }
  })

  it("stress: mélange ok/!ok, hadUser true/false → cohérence", () => {
    const cases: [ServerSessionResult | null, boolean, boolean][] = [
      [{ ok: false }, false, false],
      [{ ok: false }, true, false],
      [null, false, false],
      [null, true, false],
      [{ ok: true, user: null }, false, true],
      [{ ok: true, user: null }, true, false],
      [{ ok: true, user: {} }, false, false],
      [{ ok: true, user: {} }, true, false],
    ]
    for (const [result, hadUser, expected] of cases) {
      expect(
        shouldSetUnauthenticatedFromServerResult(result, hadUser),
        `result=${JSON.stringify(result)} hadUser=${hadUser}`
      ).toBe(expected)
    }
  })
})

describe("shouldSetUnauthenticatedFromServerResult - chaos (faux négatifs)", () => {
  it("chaos: erreur réseau (ok: false) ne doit jamais faire déconnecter", () => {
    const results: (ServerSessionResult | null)[] = [
      { ok: false },
      null,
      { ok: false },
    ]
    for (const result of results) {
      expect(
        shouldSetUnauthenticatedFromServerResult(result, false),
        "même sans hadUser, erreur → pas déconnecter"
      ).toBe(false)
      expect(
        shouldSetUnauthenticatedFromServerResult(result, true)
      ).toBe(false)
    }
  })

  it("chaos: 500 / timeout simulés (ok: false ou null) → jamais true", () => {
    const errorLikeResults: (ServerSessionResult | null)[] = [
      { ok: false },
      null,
    ]
    for (const result of errorLikeResults) {
      expect(
        shouldSetUnauthenticatedFromServerResult(result, false)
      ).toBe(false)
    }
  })

  it("chaos: seul cas true = 200 explicite avec user null et pas de hadUser", () => {
    const onlyTrueCase = shouldSetUnauthenticatedFromServerResult(
      { ok: true, user: null },
      false
    )
    expect(onlyTrueCase).toBe(true)
    // Toute autre combinaison ne doit pas être true quand ok est false ou result null
    const neverTrue = [
      [null, false] as const,
      [null, true] as const,
      [{ ok: false }, false] as const,
      [{ ok: false }, true] as const,
      [{ ok: true, user: {} }, false] as const,
      [{ ok: true, user: {} }, true] as const,
      [{ ok: true, user: null }, true] as const,
    ]
    for (const [result, hadUser] of neverTrue) {
      const r = result as ServerSessionResult | null
      if (r === null || !r.ok || r.user !== null || hadUser) {
        expect(shouldSetUnauthenticatedFromServerResult(r, hadUser)).toBe(false)
      }
    }
  })
})