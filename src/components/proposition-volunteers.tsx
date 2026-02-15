"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"
import { useLocale, useTranslations } from "next-intl"
import { UserMinus, UserPlus } from "lucide-react"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { getSupabaseClient } from "@/utils/supabase/client"
import { resolveAuthUser } from "@/utils/supabase/auth-check"
import { useToast } from "@/components/ui/toast"

export type VolunteerItem = {
  user_id: string
  skills_offered: string | null
  status: string
  username: string | null
  email: string | null
  avatar_url: string | null
}

type VolunteersContextValue = {
  volunteers: VolunteerItem[]
  isOrphan: boolean
  currentUserId: string | null
  currentUserLoaded: boolean
  joining: boolean
  leaving: boolean
  isVolunteer: boolean
  onJoin: () => Promise<void>
  onLeave: () => Promise<void>
}

const VolunteersContext = createContext<VolunteersContextValue | null>(null)

function useVolunteers() {
  const ctx = useContext(VolunteersContext)
  if (!ctx) throw new Error("PropositionVolunteers* must be used inside PropositionVolunteersProvider")
  return ctx
}

type ProviderProps = {
  propositionId: string
  isOrphan: boolean
  initialVolunteers: VolunteerItem[]
  children: React.ReactNode
}

export function PropositionVolunteersProvider({
  propositionId,
  isOrphan,
  initialVolunteers,
  children,
}: ProviderProps) {
  const t = useTranslations("Volunteers")
  const locale = useLocale()
  const { showToast } = useToast()
  const [volunteers, setVolunteers] = useState<VolunteerItem[]>(initialVolunteers)
  const [joining, setJoining] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserLoaded, setCurrentUserLoaded] = useState(false)

  const isVolunteer =
    currentUserId != null && volunteers.some((v) => v.user_id === currentUserId)

  useEffect(() => {
    const loadCurrentUser = async () => {
      const supabase = getSupabaseClient()
      if (!supabase) return
      const user = await resolveAuthUser(supabase, {
        timeoutMs: 3500,
        includeServerFallback: true,
      })
      setCurrentUserId(user?.id ?? null)
      setCurrentUserLoaded(true)
    }
    void loadCurrentUser()
  }, [])

  const onJoin = useCallback(async () => {
    const supabase = getSupabaseClient()
    if (!supabase || !currentUserId) return
    if (volunteers.some((v) => v.user_id === currentUserId)) return
    const user = await resolveAuthUser(supabase, {
      timeoutMs: 3500,
      includeServerFallback: true,
    })
    if (!user) return

    setJoining(true)
    const { error } = await supabase.from("volunteers").insert({
      proposition_id: propositionId,
      user_id: user.id,
      skills_offered: null,
      status: "Pending",
    })

    if (error) {
      setJoining(false)
      showToast({
        variant: "error",
        title: t("joinErrorTitle"),
        description: t("joinErrorBody"),
      })
      return
    }

    setVolunteers((prev) => [
      ...prev,
      {
        user_id: user.id,
        skills_offered: null,
        status: "Pending",
        username: (user.user_metadata?.username as string) ?? null,
        email: user.email ?? null,
        avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
      },
    ])

    if (isOrphan) {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "volunteer_created",
          propositionId,
          locale,
        }),
      })
    }
    showToast({
      variant: "success",
      title: t("joinSuccessTitle"),
      description: t("joinSuccessBody"),
    })
    setJoining(false)
  }, [propositionId, isOrphan, currentUserId, volunteers, showToast, locale])

  const onLeave = useCallback(async () => {
    const supabase = getSupabaseClient()
    if (!supabase || !currentUserId) return
    if (!volunteers.some((v) => v.user_id === currentUserId)) return

    setLeaving(true)
    const { error } = await supabase
      .from("volunteers")
      .delete()
      .eq("proposition_id", propositionId)
      .eq("user_id", currentUserId)

    if (!error) {
      setVolunteers((prev) => prev.filter((v) => v.user_id !== currentUserId))
      showToast({
        variant: "info",
        title: t("leaveSuccessTitle"),
      })
    }
    setLeaving(false)
  }, [propositionId, currentUserId, volunteers, showToast])

  const value: VolunteersContextValue = {
    volunteers,
    isOrphan,
    currentUserId,
    currentUserLoaded,
    joining,
    leaving,
    isVolunteer,
    onJoin,
    onLeave,
  }

  return (
    <VolunteersContext.Provider value={value}>
      {children}
    </VolunteersContext.Provider>
  )
}

function displayName(v: VolunteerItem, fallback: string) {
  return v.username || v.email || fallback
}

/** Avatars + volunteer button/status, in toolbar (left of Edit). */
export function PropositionVolunteerButton() {
  const t = useTranslations("Volunteers")
  const {
    volunteers,
    isOrphan,
    currentUserId,
    currentUserLoaded,
    joining,
    leaving,
    isVolunteer,
    onJoin,
    onLeave,
  } = useVolunteers()

  if (!currentUserLoaded) {
    return null
  }

  // Volunteers only for orphan propositions.
  if (!isOrphan) {
    return null
  }

  const avatars = (
    <div className="flex items-center -space-x-2">
      {volunteers.length === 0 && !currentUserLoaded && null}
      {volunteers.length === 0 && currentUserLoaded && null}
      {volunteers.slice(0, 6).map((v) => (
        <div
          key={v.user_id}
          className="relative z-0 rounded-full ring-2 ring-card first:ml-0 -ml-2"
          title={displayName(v, t("anonymous"))}
        >
          <Avatar
            src={v.avatar_url}
            name={displayName(v, t("anonymous"))}
            size="sm"
            className="shrink-0"
          />
        </div>
      ))}
      {volunteers.length > 6 && (
        <span className="relative z-0 -ml-2 flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-card">
          +{volunteers.length - 6}
        </span>
      )}
    </div>
  )

  if (isVolunteer) {
    return (
      <div className="flex items-center gap-2">
        {avatars}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
          disabled={leaving}
          onClick={onLeave}
        >
          <UserMinus className="size-3" />
          {t("leave")}
        </Button>
      </div>
    )
  }

  if (currentUserId) {
    return (
      <div className="flex items-center gap-2">
        {avatars}
        <Button
          variant="ghost"
          size="sm"
          disabled={joining}
          onClick={onJoin}
          className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <UserPlus className="size-3" />
          {t("join")}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {avatars}
      <span className="text-xs text-muted-foreground">
        {t("loginToVolunteer")}
      </span>
    </div>
  )
}

/** Compact menu action for volunteers (mobile). */
export function PropositionVolunteerMenuAction() {
  const t = useTranslations("Volunteers")
  const {
    isOrphan,
    currentUserId,
    currentUserLoaded,
    joining,
    leaving,
    isVolunteer,
    onJoin,
    onLeave,
  } = useVolunteers()

  if (!currentUserLoaded || !isOrphan) {
    return null
  }

  if (!currentUserId) {
    return (
      <span className="px-2 py-1.5 text-xs text-muted-foreground">
        {t("loginToVolunteer")}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={isVolunteer ? onLeave : onJoin}
      disabled={isVolunteer ? leaving : joining}
      className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-60"
    >
      {isVolunteer ? t("leave") : t("join")}
    </button>
  )
}