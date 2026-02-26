"use client"

import { useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import {
  Clock,
  CheckCircle2,
  X,
  XCircle,
} from "lucide-react"
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
      { value: "email", label: t("methodEmail"), hint: t("methodEmailHint") },
      { value: "dns", label: t("methodDns"), hint: t("methodDnsHint") },
      { value: "file", label: t("methodFile"), hint: t("methodFileHint") },
      { value: "social", label: t("methodSocial"), hint: t("methodSocialHint") },
    ],
    [t]
  )
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentRequest, setCurrentRequest] = useState<VerificationRequest | null>(null)
  const [method, setMethod] = useState(methodOptions[0]?.value ?? "email")
  const [proof, setProof] = useState("")
  const [note, setNote] = useState("")

  const selectedMethod = useMemo(
    () => methodOptions.find((option) => option.value === method),
    [method, methodOptions]
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
  const isRejected = currentRequest?.status === "rejected"
  const formDisabled = isVerified || isPending

  return (
    <div className="space-y-5 text-sm">
      {/* Header */}
      <DialogHeader className="space-y-0 text-left">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500/10">
            <span className="text-[13px] font-semibold leading-none text-sky-600">✓</span>
          </span>
          <div className="min-w-0">
            <DialogTitle className="text-sm font-semibold text-foreground">
              {t("title")}
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {isVerified ? t("alreadyVerified") : t("instructions")}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      {/* Status banner */}
      {currentRequest && (
        <div
          className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${
            isPending
              ? "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-950/20"
              : isRejected
                ? "border-destructive/20 bg-destructive/5"
                : "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-950/20"
          }`}
        >
          {isPending ? (
            <Clock className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          ) : isRejected ? (
            <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
          ) : (
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          )}
          <div className="min-w-0">
            <p
              className={`text-xs font-medium ${
                isPending
                  ? "text-amber-800 dark:text-amber-300"
                  : isRejected
                    ? "text-destructive"
                    : "text-emerald-800 dark:text-emerald-300"
              }`}
            >
              {t("statusLabel")}{" "}
              <span className="capitalize">{currentRequest.status}</span>
            </p>
            {currentRequest.reviewer_note && (
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                {t("adminNote", { note: currentRequest.reviewer_note })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Success message */}
      {statusMessage && (
        <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-500/30 dark:bg-emerald-950/20">
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
            {statusMessage}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
          <X className="mt-0.5 size-3.5 shrink-0 text-destructive" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {!isPending && !isVerified && (
        <>
          {/* Method select */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t("methodLabel")}
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm text-foreground transition-colors hover:border-primary/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
            >
              {methodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {selectedMethod?.hint && (
              <p className="text-[11px] text-muted-foreground">{selectedMethod.hint}</p>
            )}
          </div>

          {/* Proof */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t("proofLabel")}
            </label>
            <Input
              id="page-verification-proof"
              name="verificationProof"
              value={proof}
              onChange={(event) => setProof(event.target.value)}
              placeholder={selectedMethod?.hint ?? t("proofPlaceholder")}
              className="border-border bg-background text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t("noteLabel")}
            </label>
            <Textarea
              id="page-verification-note"
              name="verificationNote"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("notePlaceholder")}
              className="min-h-[80px] border-border bg-background text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Submit */}
          <div className="sticky -bottom-5 -mx-5 border-t border-border bg-background px-5 py-3">
            <Button
              size="sm"
              className="w-full gap-1.5"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : null}
              {loading ? tCommon("submitting") : t("requestButton")}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
