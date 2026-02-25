"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { AuthModal } from "@/components/auth-modal"
import {
  AUTH_QUERY_KEY,
  NEXT_QUERY_KEY,
  normalizeAuthMode,
  sanitizeNextPath,
  type AuthModalMode,
} from "@/lib/security/auth-modal-state"
import { getSupabaseClient } from "@/utils/supabase/client"
import { isAbortLikeError } from "@/lib/async-resilience"
import { useLocale } from "next-intl"

const FORCE_ONBOARDING_WELCOME_KEY = "forom_force_onboarding_welcome"

type PendingAction = () => void

type AuthModalContextValue = {
  isOpen: boolean
  mode: AuthModalMode
  nextPath: string
  openAuthModal: (mode?: AuthModalMode, nextPath?: string, pendingAction?: PendingAction) => void
  closeAuthModal: () => void
  setMode: (mode: AuthModalMode) => void
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null)

function updateUrl(
  pathname: string,
  searchParams: URLSearchParams,
  router: ReturnType<typeof useRouter>
) {
  const query = searchParams.toString()
  router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
}

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const locale = useLocale()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setModeState] = useState<AuthModalMode>("signup")
  const [nextPath, setNextPath] = useState("/")
  const finalizeInFlightRef = useRef(false)
  const pendingActionRef = useRef<PendingAction | null>(null)

  const refreshOnboardingState = useCallback(async () => {
    try {
      const supabase = getSupabaseClient()
      if (!supabase) return
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) {
        return
      }
      const forceWelcome =
        typeof window !== "undefined" &&
        window.sessionStorage.getItem(FORCE_ONBOARDING_WELCOME_KEY) === "1"
      if (forceWelcome) {
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(FORCE_ONBOARDING_WELCOME_KEY)
        }
        router.push(
          `/${locale}/onboarding?welcome=1&next=${encodeURIComponent(pathname || "/")}`
        )
        return
      }
      const response = await fetch("/api/onboarding/state", { cache: "no-store" })
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean
            onboarding?: {
              needsOnboarding?: boolean
              username?: string | null
              avatarUrl?: string | null
            }
          }
        | null
      if (!response.ok || !payload?.ok) {
        return
      }
      // Intentional UX policy:
      // Do not auto-open onboarding from generic "needsOnboarding" checks.
      // Onboarding is only auto-opened immediately after email verification.
      void payload
    } catch (error) {
      if (isAbortLikeError(error)) return
      // Ignore transient client-side fetch errors; next auth event will retry.
    }
  }, [locale, pathname, router])

  const finalizeSignedIn = useCallback(
    (requestedNextPath?: string) => {
      if (finalizeInFlightRef.current) return
      finalizeInFlightRef.current = true
      const safeNext = sanitizeNextPath(
        requestedNextPath ?? searchParams.get(NEXT_QUERY_KEY) ?? nextPath
      )
      setIsOpen(false)
      const nextParams = new URLSearchParams(searchParams.toString())
      nextParams.delete(AUTH_QUERY_KEY)
      nextParams.delete(NEXT_QUERY_KEY)
      updateUrl(pathname || "/", nextParams, router)

      const action = pendingActionRef.current
      pendingActionRef.current = null

      if (safeNext !== (pathname || "/")) {
        router.replace(safeNext, { scroll: false })
      } else if (action) {
        setTimeout(action, 300)
      }
      void refreshOnboardingState()
    },
    [nextPath, pathname, refreshOnboardingState, router, searchParams]
  )

  useEffect(() => {
    let cancelled = false
    const syncQueryModal = async () => {
      const queryMode = normalizeAuthMode(searchParams.get(AUTH_QUERY_KEY))
      const queryNext = sanitizeNextPath(searchParams.get(NEXT_QUERY_KEY))
      if (!queryMode) return
      const supabase = getSupabaseClient()
      if (supabase) {
        try {
          const { data } = await supabase.auth.getSession()
          if (!cancelled && data.session?.user) {
            finalizeSignedIn(queryNext)
            return
          }
        } catch {
          // Ignore session probe failures and continue with modal opening.
        }
      }
      if (cancelled) return
      finalizeInFlightRef.current = false
      setModeState(queryMode)
      setNextPath(queryNext)
      setIsOpen(true)
    }
    void syncQueryModal()
    return () => {
      cancelled = true
    }
  }, [finalizeSignedIn, searchParams])

  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabase) return
    void refreshOnboardingState()
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) {
        finalizeInFlightRef.current = false
        return
      }
      const hasAuthQuery = normalizeAuthMode(searchParams.get(AUTH_QUERY_KEY)) != null
      if (isOpen || hasAuthQuery) {
        finalizeSignedIn()
        return
      }
      void refreshOnboardingState()
    })
    return () => {
      subscription.subscription.unsubscribe()
    }
  }, [finalizeSignedIn, isOpen, refreshOnboardingState, searchParams])

  const openAuthModal = useCallback(
    (requestedMode: AuthModalMode = "signup", requestedNextPath?: string, pendingAction?: PendingAction) => {
      finalizeInFlightRef.current = false
      pendingActionRef.current = pendingAction ?? null
      const safeNext = sanitizeNextPath(requestedNextPath ?? `${pathname || "/"}`)
      setModeState(requestedMode)
      setNextPath(safeNext)
      setIsOpen(true)

      const nextParams = new URLSearchParams(searchParams.toString())
      nextParams.set(AUTH_QUERY_KEY, requestedMode)
      nextParams.set(NEXT_QUERY_KEY, safeNext)
      updateUrl(pathname || "/", nextParams, router)
    },
    [pathname, router, searchParams]
  )

  const closeAuthModal = useCallback(() => {
    finalizeInFlightRef.current = false
    pendingActionRef.current = null
    setIsOpen(false)
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete(AUTH_QUERY_KEY)
    nextParams.delete(NEXT_QUERY_KEY)
    updateUrl(pathname || "/", nextParams, router)
  }, [pathname, router, searchParams])

  const setMode = useCallback(
    (requestedMode: AuthModalMode) => {
      setModeState(requestedMode)
      const nextParams = new URLSearchParams(searchParams.toString())
      nextParams.set(AUTH_QUERY_KEY, requestedMode)
      nextParams.set(NEXT_QUERY_KEY, nextPath)
      updateUrl(pathname || "/", nextParams, router)
    },
    [pathname, router, searchParams, nextPath]
  )

  const value = useMemo<AuthModalContextValue>(
    () => ({
      isOpen,
      mode,
      nextPath,
      openAuthModal,
      closeAuthModal,
      setMode,
    }),
    [isOpen, mode, nextPath, openAuthModal, closeAuthModal, setMode]
  )

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      <AuthModal
        open={isOpen}
        mode={mode}
        nextPath={nextPath}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closeAuthModal()
            return
          }
          setIsOpen(true)
        }}
        onModeChange={setMode}
        onSignedIn={finalizeSignedIn}
      />
    </AuthModalContext.Provider>
  )
}

export function useAuthModal(): AuthModalContextValue {
  const value = useContext(AuthModalContext)
  if (!value) {
    throw new Error("useAuthModal must be used within AuthModalProvider")
  }
  return value
}
