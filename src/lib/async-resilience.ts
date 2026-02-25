export class AsyncTimeoutError extends Error {
    constructor(message = "Operation timed out") {
      super(message)
      this.name = "AsyncTimeoutError"
    }
  }
  
  export const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms))
  
  export const isAbortLikeError = (error: unknown): boolean => {
    if (!error || typeof error !== "object") return false
    const name =
      "name" in error && typeof (error as { name?: unknown }).name === "string"
        ? ((error as { name?: string }).name ?? "")
        : ""
    const message =
      "message" in error &&
      typeof (error as { message?: unknown }).message === "string"
        ? ((error as { message?: string }).message ?? "")
        : ""
    const normalizedName = name.toLowerCase()
    const normalizedMessage = message.toLowerCase()
    return (
      normalizedName === "aborterror" ||
      normalizedMessage.includes("signal is aborted") ||
      normalizedMessage.includes("aborted")
    )
  }
  
  export async function withTimeoutPromise<T>(
    promise: PromiseLike<T>,
    timeoutMs: number,
    timeoutMessage?: string
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new AsyncTimeoutError(timeoutMessage))
      }, timeoutMs)
  
      Promise.resolve(promise)
        .then((value) => {
          clearTimeout(timeoutId)
          resolve(value)
        })
        .catch((error) => {
          clearTimeout(timeoutId)
          if (isAbortLikeError(error)) {
            reject(new AsyncTimeoutError())
            return
          }
          reject(error)
        })
    })
  }
  
  type RetryOptions = {
    attempts?: number
    delayMs?: number
    shouldRetry?: (error: unknown, attempt: number) => boolean
  }
  
  export async function withRetry<T>(
    operation: () => Promise<T>,
    options?: RetryOptions
  ): Promise<T> {
    const attempts = Math.max(1, options?.attempts ?? 2)
    const delayMs = Math.max(0, options?.delayMs ?? 200)
    const shouldRetry = options?.shouldRetry ?? (() => true)
    let lastError: unknown
  
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await operation()
      } catch (error) {
        lastError = error
        if (attempt >= attempts || !shouldRetry(error, attempt)) {
          break
        }
        await sleep(delayMs * attempt)
      }
    }
  
    throw lastError instanceof Error
      ? lastError
      : new Error("Operation failed")
  }
  
  export async function fetchWithTimeout(
    input: RequestInfo | URL,
    init: RequestInit = {},
    timeoutMs = 15000
  ): Promise<Response> {
    if (init.signal?.aborted) {
      throw new AsyncTimeoutError("Signal already aborted")
    }

    const controller = new AbortController()
    const id = setTimeout(() => controller.abort("timeout"), timeoutMs)

    const onExternalAbort = () => { controller.abort() }
    init.signal?.addEventListener("abort", onExternalAbort)

    try {
      return await fetch(input, { ...init, signal: controller.signal })
    } catch (error) {
      if (isAbortLikeError(error) || controller.signal.aborted) {
        throw new AsyncTimeoutError()
      }
      throw error
    } finally {
      clearTimeout(id)
      init.signal?.removeEventListener("abort", onExternalAbort)
    }
  }