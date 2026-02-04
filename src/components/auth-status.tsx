"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { getSupabaseClient } from "@/utils/supabase/client"

export function AuthStatus() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const { showToast } = useToast()

  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setIsAuthenticated(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setIsAuthenticated(Boolean(data.session))
    })

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setIsAuthenticated(Boolean(session))
      }
    )

    return () => {
      subscription.subscription.unsubscribe()
    }
  }, [])

  const handleSignOut = async () => {
    const supabase = getSupabaseClient()
    if (!supabase) return
    await supabase.auth.signOut()
    showToast({
      variant: "info",
      title: "Déconnecté",
      description: "Vous êtes maintenant déconnecté.",
    })
    router.refresh()
  }

  if (isAuthenticated === null) {
    return (
      <Button variant="ghost" size="sm" disabled>
        Chargement...
      </Button>
    )
  }

  if (!isAuthenticated) {
    return (
      <Button asChild size="sm" variant="outline" className="link-nav">
        <Link href="/login">Se connecter</Link>
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button asChild size="sm" variant="ghost" className="link-nav">
        <Link href="/profile">Profil</Link>
      </Button>
      <Button size="sm" variant="ghost" onClick={handleSignOut} className="link-nav">
        Se déconnecter
      </Button>
    </div>
  )
}
