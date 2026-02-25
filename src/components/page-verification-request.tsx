"use client"

import { useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { getSupabaseClient } from "@/utils/supabase/client"
import { resolveAuthUser } from "@/utils/supabase/auth-check"

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

export function PageVerificationRequest({
  pageId,
  ownerId,
  isVerified,
}: Props) {
  const t = useTranslations("PageVerification")
  const tCommon = useTranslations("Common")
  const methodOptions = useMemo(
    () => [
      {
        value: "email",
        label: t("methodEmail"),
        hint: t("methodEmailHint"),
      },
      {
        value: "dns",
        label: t("methodDns"),
        hint: t("methodDnsHint"),
      },
      {
        value: "file",
        label: t("methodFile"),
        hint: t("methodFileHint"),
      },
      {
        value: "social",
        label: t("methodSocial"),
        hint: t("methodSocialHint"),
      },
    ],
    [t]
  )
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
      const user = await resolveAuthUser(supabase, {
        timeoutMs: 3500,
        includeServerFallback: true,
      })
      if (!user || user.id !== ownerId) return

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
      setError(t("supabaseNotConfigured"))
      return
    }
    const user = await resolveAuthUser(supabase, {
      timeoutMs: 3500,
      includeServerFallback: true,
    })
    if (!user || user.id !== ownerId) {
      setError(t("notAuthorized"))
      return
    }
    if (!proof.trim()) {
      setError(t("missingProof"))
      return
    }

    setLoading(true)
    setError(null)
    const { error: insertError } = await supabase
      .from("page_verification_requests")
      .insert({
        page_id: pageId,
        requested_by: user.id,
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

    setStatusMessage(t("requestSent"))
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
    <div className="space-y-4 text-sm">
      <DialogHeader className="space-y-1 text-left">
        <DialogTitle className="text-3xl font-bold tracking-tight text-foreground">
          {t("title")}
        </DialogTitle>
        <DialogDescription className="text-base text-muted-foreground">
          {isVerified ? t("alreadyVerified") : t("instructions")}
        </DialogDescription>
      </DialogHeader>

      {currentRequest && (
        <div className="rounded-md border border-border bg-background p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("latestRequest")}
          </p>
          <p className="text-sm text-foreground">
            {t("statusLabel")}{" "}
            <span className="font-medium capitalize">
              {currentRequest.status}
            </span>
          </p>
          {currentRequest.reviewer_note && (
            <p className="text-xs text-muted-foreground">
              {t("adminNote", { note: currentRequest.reviewer_note })}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {t("methodLabel")}
        </label>
        <select
          id="page-verification-method"
          name="verificationMethod"
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
          {t("proofLabel")}
        </label>
        <Input
          id="page-verification-proof"
          name="verificationProof"
          value={proof}
          onChange={(event) => setProof(event.target.value)}
          placeholder={t("proofPlaceholder")}
          className="border-border bg-background text-foreground placeholder:text-muted-foreground"
          disabled={isVerified || isPending}
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {t("noteLabel")}
        </label>
        <Textarea
          id="page-verification-note"
          name="verificationNote"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t("notePlaceholder")}
          className="min-h-[92px] border-border bg-background text-foreground placeholder:text-muted-foreground"
          disabled={isVerified || isPending}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {statusMessage && (
        <p className="text-sm text-foreground">{statusMessage}</p>
      )}

      <div>
        <Button
          onClick={handleSubmit}
          disabled={loading || isVerified || isPending}
          className="h-11 w-full bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {isVerified
            ? t("verifiedButton")
            : isPending
            ? t("pendingButton")
            : loading
            ? tCommon("submitting")
            : t("requestButton")}
        </Button>
      </div>
    </div>
  )
}