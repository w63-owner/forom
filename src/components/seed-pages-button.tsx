"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

export function SeedPagesButton() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleClick = async () => {
    setLoading(true)
    setMessage(null)
    const response = await fetch("/api/seed-pages", { method: "POST" })
    if (!response.ok) {
      const detail = await response.text().catch(() => "")
      setMessage(
        `Erreur lors de la création.${detail ? ` (${detail})` : ""}`
      )
      setLoading(false)
      return
    }
    setMessage("Pages générées.")
    setLoading(false)
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleClick} disabled={loading}>
        {loading ? "Génération..." : "Générer les pages"}
      </Button>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  )
}
