import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  AsyncTimeoutError,
  sleep,
  withTimeoutPromise,
  withRetry,
  fetchWithTimeout,
  isAbortLikeError,
} from "@/lib/async-resilience"

describe("AsyncTimeoutError", () => {
  it("has name AsyncTimeoutError", () => {
    const err = new AsyncTimeoutError()
    expect(err.name).toBe("AsyncTimeoutError")
    expect(err).toBeInstanceOf(Error)
  })

  it("uses custom message when provided", () => {
    const err = new AsyncTimeoutError("Custom timeout")
    expect(err.message).toBe("Custom timeout")
  })
})

describe("isAbortLikeError", () => {
  it("returns true for AbortError", () => {
    expect(isAbortLikeError(new DOMException("aborted", "AbortError"))).toBe(true)
  })

  it("returns true for message containing 'signal is aborted'", () => {
    expect(isAbortLikeError(new Error("signal is aborted"))).toBe(true)
  })

  it("returns false for generic Error", () => {
    expect(isAbortLikeError(new Error("network failed"))).toBe(false)
  })
})

describe("withTimeoutPromise", () => {
  it("resolves with value when promise resolves before timeout", async () => {
    const result = await withTimeoutPromise(Promise.resolve(42), 1000)
    expect(result).toBe(42)
  })

  it("rejects with AsyncTimeoutError when promise exceeds timeout", async () => {
    const slow = new Promise<string>((resolve) =>
      setTimeout(() => resolve("late"), 200)
    )
    await expect(withTimeoutPromise(slow, 50)).rejects.toThrow(AsyncTimeoutError)
  })

  it("rejects with original error when promise rejects before timeout", async () => {
    const failing = Promise.reject(new Error("fail"))
    await expect(withTimeoutPromise(failing, 1000)).rejects.toThrow("fail")
  })
})

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const result = await withRetry(() => Promise.resolve("ok"))
    expect(result).toBe("ok")
  })

  it("retries on failure when shouldRetry returns true and eventually succeeds", async () => {
    let attempts = 0
    const result = await withRetry(
      () => {
        attempts++
        if (attempts < 2) return Promise.reject(new Error("transient"))
        return Promise.resolve("ok")
      },
      { attempts: 3, delayMs: 10, shouldRetry: () => true }
    )
    expect(result).toBe("ok")
    expect(attempts).toBe(2)
  })

  it("stops retrying when shouldRetry returns false", async () => {
    let attempts = 0
    await expect(
      withRetry(
        () => {
          attempts++
          return Promise.reject(new Error("permanent"))
        },
        { attempts: 3, delayMs: 10, shouldRetry: () => false }
      )
    ).rejects.toThrow("permanent")
    expect(attempts).toBe(1)
  })

  it("retries on AsyncTimeoutError when shouldRetry checks for timeout", async () => {
    let attempts = 0
    const result = await withRetry(
      () => {
        attempts++
        if (attempts < 2) return Promise.reject(new AsyncTimeoutError())
        return Promise.resolve("ok")
      },
      {
        attempts: 3,
        delayMs: 10,
        shouldRetry: (e) => e instanceof AsyncTimeoutError,
      }
    )
    expect(result).toBe("ok")
    expect(attempts).toBe(2)
  })
})

describe("fetchWithTimeout", () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("resolves with response when fetch completes before timeout", async () => {
    const res = new Response(JSON.stringify({ ok: true }))
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(res)
    const result = await fetchWithTimeout("/api/test", {}, 5000)
    expect(result).toBe(res)
  })

  it("rejects with AsyncTimeoutError when fetch rejects with AbortError", async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new DOMException("The user aborted a request.", "AbortError")
    )
    await expect(
      fetchWithTimeout("/api/aborted", {}, 1000)
    ).rejects.toThrow(AsyncTimeoutError)
  })
})