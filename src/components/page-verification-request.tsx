"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { getSupabaseClient } from "@/utils/supabase/client"

type Props = {
  pageId: string
  ownerId: string
  isVerified: boolean
}

type VerificationRequest = {
  id: string
  status: string
  method: string
  proof: string | null
  requester_note: string | null
  reviewer_note: string | null
  created_at: string
}

const methodOptions = [
  {
    value: "email",
    label: "Email pro",
    hint: "ex: nom@entreprise.com",
  },
  {
    value: "dns",
    label: "DNS TXT",
    hint: "ex: TXT _forom-verification=xxxx",
  },
  {
    value: "file",
    label: "Fichier HTML",
    hint: "ex: https://site.com/forom-verification.html",
  },
  {
    value: "social",
    label: "Lien compte officiel",
    hint: "ex: https://linkedin.com/company/...",
  },
]

export function PageVerificationRequest({
  pageId,
  ownerId,
  isVerified,
}: Props) {
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentRequest, setCurrentRequest] = useState<VerificationRequest | null>(
    null
  )
  const [method, setMethod] = useState(methodOptions[0]?.value ?? "email")
  const [proof, setProof] = useState("")
  const [note, setNote] = useState("")

  const selectedMethod = useMemo(
    () => methodOptions.find((option) => option.value === method),
    [method]
  )

  useEffect(() => {
    const fetchRequest = async () => {
      const supabase = getSupabaseClient()
      if (!supabase) return
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user || userData.user.id !== ownerId) return

      const { data } = await supabase
        .from("page_verification_requests")
        .select(
          "id, status, method, proof, requester_note, reviewer_note, created_at"
        )
        .eq("page_id", pageId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (data) {
        setCurrentRequest(data)
      }
    }

    fetchRequest()
  }, [ownerId, pageId])

  const handleSubmit = async () => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setError("Supabase non configuré.")
      return
    }
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user || userData.user.id !== ownerId) {
      setError("Vous n'êtes pas autorisé.")
      return
    }
    if (!proof.trim()) {
      setError("Ajoutez une preuve pour la vérification.")
      return
    }

    setLoading(true)
    setError(null)
    const { error: insertError } = await supabase
      .from("page_verification_requests")
      .insert({
        page_id: pageId,
        requested_by: userData.user.id,
        method,
        proof: proof.trim(),
        requester_note: note.trim() || null,
      })
      .select(
        "id, status, method, proof, requester_note, reviewer_note, created_at"
      )
      .single()

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    setStatusMessage("Demande envoyée. Nous reviendrons vers vous rapidement.")
    setLoading(false)
    setProof("")
    setNote("")
    const { data } = await supabase
      .from("page_verification_requests")
      .select(
        "id, status, method, proof, requester_note, reviewer_note, created_at"
      )
      .eq("page_id", pageId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) {
      setCurrentRequest(data)
    }
  }

  const isPending = currentRequest?.status === "pending"

  return (
    <div className="space-y-3 rounded-lg border border-border bg-background/60 p-4 text-sm">
      <p className="font-medium text-foreground">Demande de vérification</p>
      {isVerified ? (
        <p className="text-muted-foreground">
          Cette page est déjà vérifiée.
        </p>
      ) : (
        <p className="text-muted-foreground">
          Fournissez une preuve pour confirmer que vous représentez cette page.
        </p>
      )}

      {currentRequest && (
        <div className="rounded-md border border-border bg-background p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Dernière demande
          </p>
          <p className="text-sm text-foreground">
            Statut:{" "}
            <span className="font-medium capitalize">
              {currentRequest.status}
            </span>
          </p>
          {currentRequest.reviewer_note && (
            <p className="text-xs text-muted-foreground">
              Note admin: {currentRequest.reviewer_note}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Méthode
        </label>
        <select
          value={method}
          onChange={(event) => setMethod(event.target.value)}
          className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          disabled={isVerified || isPending}
        >
          {methodOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {selectedMethod?.hint && (
          <p className="text-xs text-muted-foreground">{selectedMethod.hint}</p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Preuve
        </label>
        <input
          value={proof}
          onChange={(event) => setProof(event.target.value)}
          placeholder="Lien, email ou code de vérification"
          className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          disabled={isVerified || isPending}
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Note (optionnel)
        </label>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Ajoutez un contexte si besoin"
          className="min-h-[80px] w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
          disabled={isVerified || isPending}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {statusMessage && (
        <p className="text-sm text-foreground">{statusMessage}</p>
      )}

      <div className="flex justify-end">
        <Button size="sm" onClick={handleSubmit} disabled={loading || isVerified || isPending}>
          {isVerified
            ? "Page vérifiée"
            : isPending
            ? "Demande en cours"
            : loading
            ? "Envoi..."
            : "Demander une vérification"}
        </Button>
      </div>
    </div>
  )
}
