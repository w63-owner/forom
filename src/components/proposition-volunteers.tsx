"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"
import { UserMinus, UserPlus } from "lucide-react"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { getSupabaseClient } from "@/utils/supabase/client"
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
  const { showToast } = useToast()
  const [volunteers, setVolunteers] = useState<VolunteerItem[]>(initialVolunteers)
  const [joining, setJoining] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserLoaded, setCurrentUserLoaded] = useState(false)

  const isVolunteer =
    currentUserId != null && volunteers.some((v) => v.user_id === currentUserId)

  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setCurrentUserLoaded(true)
      return
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null)
      setCurrentUserLoaded(true)
    })
  }, [])

  const onJoin = useCallback(async () => {
    const supabase = getSupabaseClient()
    if (!supabase || !currentUserId) return
    if (volunteers.some((v) => v.user_id === currentUserId)) return
    const {
      data: { user },
    } = await supabase.auth.getUser()
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
        title: "Impossible de vous ajouter comme volontaire",
        description: "Une erreur est survenue. Réessayez dans quelques instants.",
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
        }),
      })
    }
    showToast({
      variant: "success",
      title: "Vous êtes volontaire",
      description: "L’auteur sera notifié si la proposition est orpheline.",
    })
    setJoining(false)
  }, [propositionId, isOrphan, currentUserId, volunteers, showToast])

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
        title: "Vous n’êtes plus volontaire",
      })
    }
    setLeaving(false)
  }, [propositionId, currentUserId, volunteers, showToast])

  const value: VolunteersContextValue = {
    volunteers,
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

function displayName(v: VolunteerItem) {
  return v.username || v.email || "Anonyme"
}

/** Avatars + bouton/statut volontaire, à placer dans la toolbar (à gauche de Modifier). */
export function PropositionVolunteerButton() {
  const {
    volunteers,
    currentUserId,
    currentUserLoaded,
    joining,
    leaving,
    isVolunteer,
    onJoin,
    onLeave,
  } = useVolunteers()

  const avatars = (
    <div className="flex items-center -space-x-2">
      {volunteers.length === 0 && !currentUserLoaded && null}
      {volunteers.length === 0 && currentUserLoaded && null}
      {volunteers.slice(0, 6).map((v) => (
        <div
          key={v.user_id}
          className="relative z-0 rounded-full ring-2 ring-card first:ml-0 -ml-2"
          title={displayName(v)}
        >
          <Avatar
            src={v.avatar_url}
            name={displayName(v)}
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

  if (!currentUserLoaded) {
    return (
      <div className="flex items-center gap-2">
        {avatars}
      </div>
    )
  }

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
          Se retirer
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
          Rejoindre les volontaires
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {avatars}
      <span className="text-xs text-muted-foreground">
        Connectez-vous pour vous porter volontaire
      </span>
    </div>
  )
}
