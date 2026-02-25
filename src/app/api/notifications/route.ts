import { NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getSupabaseServerClient } from "@/utils/supabase/server"
import {
  INTERNAL_SIGNATURE_HEADER,
  INTERNAL_TIMESTAMP_HEADER,
  verifyInternalRequestSignature,
} from "@/lib/security/internal-signature"
import { validateMutationOrigin } from "@/lib/security/origin-guard"

export const dynamic = "force-dynamic"

type NotificationPayload = {
  type:
    | "comment_created"
    | "volunteer_created"
    | "solution_marked"
    | "solution_unmarked"
    | "status_done"
    | "status_change"
    | "proposition_created_linked"
    | "owner_vote_threshold"
    | "page_parent_request"
  propositionId?: string
  pageId?: string
  childPageId?: string
  commentId?: string
  actorUserId?: string
  newStatus?: string
  locale?: "en" | "fr"
}

const statusCanBeUpdatedByActor = async ({
  propositionAuthorId,
  propositionPageId,
  actorUserId,
  supabase,
}: {
  propositionAuthorId: string | null
  propositionPageId: string | null
  actorUserId: string
  supabase: SupabaseClient
}): Promise<boolean> => {
  if (!propositionPageId) {
    return propositionAuthorId === actorUserId
  }
  const { data: page } = await supabase
    .from("pages")
    .select("owner_id")
    .eq("id", propositionPageId)
    .maybeSingle()
  const pageOwnerId = (page as { owner_id?: string | null } | null)?.owner_id ?? null
  return pageOwnerId === actorUserId
}

export const validateNotificationAuthorization = async ({
  supabase,
  payload,
  authenticatedUserId,
  proposition,
}: {
  supabase: SupabaseClient
  payload: NotificationPayload
  authenticatedUserId: string
  proposition: {
    id: string
    author_id: string | null
    page_id: string | null
  } | null
}): Promise<{ ok: true; actorUserId: string } | { ok: false; error: string }> => {
  const actorUserId = payload.actorUserId ?? authenticatedUserId
  if (actorUserId !== authenticatedUserId) {
    return { ok: false, error: "Forbidden actorUserId." }
  }

  if (payload.type === "page_parent_request") {
    if (!payload.pageId || !payload.childPageId) {
      return { ok: false, error: "Missing mother page payload." }
    }
    const { data: requestRow } = await supabase
      .from("page_parent_requests")
      .select("id, requested_by")
      .eq("parent_page_id", payload.pageId)
      .eq("child_page_id", payload.childPageId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!requestRow || requestRow.requested_by !== actorUserId) {
      return { ok: false, error: "Forbidden parent request actor." }
    }
    return { ok: true, actorUserId }
  }

  if (
    payload.type === "comment_created" ||
    payload.type === "solution_marked" ||
    payload.type === "solution_unmarked"
  ) {
    if (!payload.commentId || !payload.propositionId) {
      return { ok: false, error: "Missing comment payload." }
    }
    const { data: comment } = await supabase
      .from("comments")
      .select("id, proposition_id, user_id")
      .eq("id", payload.commentId)
      .maybeSingle()
    if (!comment || comment.proposition_id !== payload.propositionId) {
      return { ok: false, error: "Comment/proposition mismatch." }
    }
    if (payload.type === "comment_created" && comment.user_id !== actorUserId) {
      return { ok: false, error: "Forbidden comment actor." }
    }
    if (payload.type !== "comment_created") {
      if (!proposition) {
        return { ok: false, error: "Missing proposition for status checks." }
      }
      const canManageSolution = await statusCanBeUpdatedByActor({
        propositionAuthorId: proposition.author_id,
        propositionPageId: proposition.page_id,
        actorUserId,
        supabase,
      })
      if (!canManageSolution) {
        return { ok: false, error: "Forbidden solution actor." }
      }
    }
    return { ok: true, actorUserId }
  }

  if (payload.type === "volunteer_created") {
    if (!payload.propositionId) {
      return { ok: false, error: "Missing propositionId." }
    }
    const { data: volunteer } = await supabase
      .from("volunteers")
      .select("user_id")
      .eq("proposition_id", payload.propositionId)
      .eq("user_id", actorUserId)
      .maybeSingle()
    if (!volunteer) {
      return { ok: false, error: "Forbidden volunteer actor." }
    }
    return { ok: true, actorUserId }
  }

  if (
    payload.type === "status_done" ||
    payload.type === "status_change" ||
    payload.type === "proposition_created_linked"
  ) {
    if (!proposition) {
      return { ok: false, error: "Missing proposition." }
    }
    if (payload.type === "proposition_created_linked") {
      if (proposition.author_id !== actorUserId) {
        return { ok: false, error: "Forbidden proposition actor." }
      }
      return { ok: true, actorUserId }
    }
    const canUpdateStatus = await statusCanBeUpdatedByActor({
      propositionAuthorId: proposition.author_id,
      propositionPageId: proposition.page_id,
      actorUserId,
      supabase,
    })
    if (!canUpdateStatus) {
      return { ok: false, error: "Forbidden status actor." }
    }
    return { ok: true, actorUserId }
  }

  if (payload.type === "owner_vote_threshold") {
    if (!payload.propositionId) {
      return { ok: false, error: "Missing propositionId." }
    }
    const { data: vote } = await supabase
      .from("votes")
      .select("user_id")
      .eq("proposition_id", payload.propositionId)
      .eq("user_id", actorUserId)
      .maybeSingle()
    if (!vote) {
      return { ok: false, error: "Forbidden vote actor." }
    }
    return { ok: true, actorUserId }
  }

  return { ok: false, error: "Unsupported notification type." }
}

export async function GET() {
  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase unavailable." },
      { status: 500 }
    )
  }

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 })
  }

  const email = authData.user.email?.trim() ?? ""
  if (!email) {
    return NextResponse.json({ ok: true, notifications: [] })
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, created_at, read_at")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, notifications: data ?? [] })
}

const sendEmail = async ({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) => {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL ?? "no-reply@change.app"
  if (!apiKey) return
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
    }),
  })
  if (!response.ok) {
    const errorText = await response.text().catch(() => "")
    throw new Error(
      `Resend error (${response.status}): ${errorText || "unknown"}`
    )
  }
}

export async function POST(request: Request) {
  const originValidation = validateMutationOrigin(request)
  if (!originValidation.ok) {
    return NextResponse.json(
      { ok: false, error: originValidation.reason ?? "Forbidden origin." },
      { status: 403 }
    )
  }

  const rawBody = await request.text().catch(() => "")
  const signatureValidation = verifyInternalRequestSignature({
    payload: rawBody,
    signature: request.headers.get(INTERNAL_SIGNATURE_HEADER),
    timestamp: request.headers.get(INTERNAL_TIMESTAMP_HEADER),
    secret: process.env.INTERNAL_API_SIGNING_SECRET,
    required: process.env.INTERNAL_API_SIGNING_REQUIRED === "true",
  })
  if (!signatureValidation.ok) {
    return NextResponse.json(
      { ok: false, error: signatureValidation.reason ?? "Invalid signature." },
      { status: 403 }
    )
  }

  let payload: NotificationPayload | null = null
  try {
    payload = JSON.parse(rawBody) as NotificationPayload
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 })
  }
  if (!payload?.type) {
    return NextResponse.json(
      { ok: false, error: "Missing notification payload." },
      { status: 400 }
    )
  }
  const locale = payload.locale === "fr" ? "fr" : "en"
  const t = (en: string, fr: string) => (locale === "fr" ? fr : en)
  const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  const appUrl =
    rawAppUrl && rawAppUrl.startsWith("http")
      ? rawAppUrl.replace(/\/+$/, "")
      : "https://www.forom.app"
  const anonymousLabel = t("Anonymous", "Anonyme")
  const viewPropositionLabel = t("View proposition", "Voir la proposition")
  const viewPageLabel = t("View page", "Voir la page")
  const authorLabel = t("Author", "Auteur")
  const statusLabels: Record<string, Record<string, string>> = {
    en: {
      Open: "Open",
      "In Progress": "In progress",
      Done: "Done",
      "Won't Do": "Won't do",
    },
    fr: {
      Open: "Ouvert",
      "In Progress": "En cours",
      Done: "Terminé",
      "Won't Do": "Ne sera pas fait",
    },
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
  const authSupabase = await getSupabaseServerClient()
  if (!authSupabase) {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
  const { data: userData } = await authSupabase.auth.getUser()
  if (!userData.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 })
  }
  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const safeSendEmail = async (args: Parameters<typeof sendEmail>[0]) => {
    try {
      await sendEmail(args)
    } catch (error) {
      console.error("Failed to send email", error)
    }
  }

  // Database triggers are now the source of truth for in-app notifications.
  // This API route only handles outbound emails as a side effect.
  const notifyRecipient = async ({
    email,
    subject,
    html,
    ...notificationPayload
  }: {
    email: string
    subject: string
    message: string
    link: string
    html: string
    type: NotificationPayload["type"]
    notificationTitle?: string
    notificationBody?: string
  }) => {
    // Keep payload fields for compatibility with existing call sites.
    void notificationPayload
    await safeSendEmail({
      to: email,
      subject,
      html,
    })
  }

  let proposition: {
    id: string
    title: string | null
    author_id: string | null
    page_id: string | null
    notify_comments: boolean | null
    notify_volunteers: boolean | null
    notify_solutions: boolean | null
  } | null = null

  if (payload.propositionId) {
    const { data: loadedProposition, error: propositionError } = await supabase
      .from("propositions")
      .select(
        "id, title, author_id, page_id, notify_comments, notify_volunteers, notify_solutions"
      )
      .eq("id", payload.propositionId)
      .maybeSingle()

    if (propositionError) {
      return NextResponse.json(
        { ok: false, error: propositionError.message },
        { status: 500 }
      )
    }
    proposition = loadedProposition
    if (!proposition) {
      return NextResponse.json({ ok: true })
    }
  }

  const authz = await validateNotificationAuthorization({
    supabase,
    payload,
    authenticatedUserId: userData.user.id,
    proposition: proposition
      ? {
          id: proposition.id,
          author_id: proposition.author_id,
          page_id: proposition.page_id,
        }
      : null,
  })
  if (!authz.ok) {
    return NextResponse.json({ ok: false, error: authz.error }, { status: 403 })
  }

  if (payload.type === "page_parent_request") {
    if (!payload.pageId || !payload.childPageId) {
      return NextResponse.json(
        { ok: false, error: "Missing mother page payload." },
        { status: 400 }
      )
    }

    const [{ data: parentPage }, { data: childPage }] = await Promise.all([
      supabase
        .from("pages")
        .select("id, name, slug, owner_id")
        .eq("id", payload.pageId)
        .maybeSingle(),
      supabase
        .from("pages")
        .select("id, name, slug, owner_id")
        .eq("id", payload.childPageId)
        .maybeSingle(),
    ])

    if (!parentPage?.owner_id || !parentPage.slug) {
      return NextResponse.json({ ok: true })
    }

    const recipientOwnerId =
      authz.actorUserId === parentPage.owner_id ? childPage?.owner_id ?? null : parentPage.owner_id
    if (!recipientOwnerId || recipientOwnerId === authz.actorUserId) {
      return NextResponse.json({ ok: true })
    }

    const [{ data: recipientUser }, { data: actor }] = await Promise.all([
      supabase
        .from("users")
        .select("email, username")
        .eq("id", recipientOwnerId)
        .maybeSingle(),
      authz.actorUserId
        ? supabase
            .from("users")
            .select("email, username")
            .eq("id", authz.actorUserId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    const recipientEmail = recipientUser?.email
    if (!recipientEmail) {
      return NextResponse.json({ ok: true })
    }

    const requesterLabel =
      actor?.username || actor?.email || anonymousLabel
    const childLabel = childPage?.name || t("a page", "une page")
    const parentLabel = parentPage.name || t("a page", "une page")
    const subject = t(
      `New sub-page request: ${childLabel}`,
      `Nouvelle demande de sous-page : ${childLabel}`
    )
    const message = t(
      `${requesterLabel} wants to link ${childLabel} to ${parentLabel}.`,
      `${requesterLabel} souhaite relier ${childLabel} à ${parentLabel}.`
    )
    const parentUrl = `${appUrl}/${locale}/pages/${parentPage.slug}`

    const { data: requestRow } = await supabase
      .from("page_parent_requests")
      .select("id")
      .eq("child_page_id", payload.childPageId)
      .eq("parent_page_id", payload.pageId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    const link = requestRow?.id
      ? `${parentUrl}?parent_request_id=${requestRow.id}`
      : parentUrl

    await notifyRecipient({
      email: recipientEmail,
      subject,
      message,
      link,
      html: `<p>${message}</p><p><a href="${parentUrl}">${viewPageLabel}</a></p>`,
      type: payload.type,
      notificationTitle: parentLabel,
      notificationBody: t(
        "A sub-page link request was submitted.",
        "Une demande de liaison de sous-page a été soumise."
      ),
    })

    return NextResponse.json({ ok: true })
  }

  if (!payload.propositionId) {
    return NextResponse.json(
      { ok: false, error: "Missing propositionId." },
      { status: 400 }
    )
  }
  if (!proposition) {
    return NextResponse.json({ ok: true })
  }

  const { data: author, error: authorError } = await supabase
    .from("users")
    .select("email, username")
    .eq("id", proposition.author_id)
    .maybeSingle()
  if (authorError) {
    return NextResponse.json(
      { ok: false, error: authorError.message },
      { status: 500 }
    )
  }

  const getUserEmail = (
    users: { email?: string | null } | { email?: string | null }[] | null | undefined
  ) => (Array.isArray(users) ? users[0]?.email : users?.email)

  const getUser = (
    users: { username?: string | null; email?: string | null } | Array<{
      username?: string | null
      email?: string | null
    }> | null | undefined
  ) => (Array.isArray(users) ? users[0] : users)

  const propositionUrl = `${appUrl}/${locale}/propositions/${proposition.id}`
  const propositionLabel = proposition.title || t("Proposition", "Proposition")

  if (payload.type === "comment_created") {
    if (!payload.commentId) {
      return NextResponse.json(
        { ok: false, error: "Missing commentId." },
        { status: 400 }
      )
    }
    if (!proposition.notify_comments) return NextResponse.json({ ok: true })
    const { data: comment } = await supabase
      .from("comments")
      .select("id, content, user_id, users(username, email)")
      .eq("id", payload.commentId)
      .maybeSingle()
    if (author?.email && comment) {
      const commenter = getUser(comment.users)
      const subject = t(
        `New comment: ${proposition.title}`,
        `Nouveau commentaire : ${proposition.title}`
      )
      const message = t(
        "A new comment was posted for your proposition.",
        `Un nouveau commentaire a été publié pour votre proposition ${proposition.title}.`
      )
      await notifyRecipient({
        email: author.email,
        subject,
        message,
        link: propositionUrl,
        html: `<p>${message}</p>
<p>${authorLabel}: ${commenter?.username || commenter?.email || anonymousLabel}</p>
<p>${comment.content}</p>
<p><a href="${propositionUrl}">${viewPropositionLabel}</a></p>`,
        type: payload.type,
        notificationTitle: propositionLabel,
        notificationBody: t(
          "A new comment was posted for your proposition.",
          "Un nouveau commentaire a été publié pour votre proposition."
        ),
      })
    }
  }

  if (payload.type === "volunteer_created") {
    if (!proposition.notify_volunteers) return NextResponse.json({ ok: true })
    if (proposition.page_id) return NextResponse.json({ ok: true })
    if (author?.email) {
      const subject = t(
        `New volunteer: ${proposition.title}`,
        `Nouveau volontaire : ${proposition.title}`
      )
      const message = t(
        `A user volunteered for ${proposition.title}.`,
        `Un utilisateur s'est porté volontaire pour ${proposition.title}.`
      )
      await notifyRecipient({
        email: author.email,
        subject,
        message,
        link: propositionUrl,
        html: `<p>${message}</p>
<p><a href="${propositionUrl}">${viewPropositionLabel}</a></p>`,
        type: payload.type,
        notificationTitle: propositionLabel,
        notificationBody: t(
          "A new volunteer joined your proposition.",
          "Un nouveau volontaire a rejoint votre proposition."
        ),
      })
    }
  }

  if (payload.type === "solution_marked" || payload.type === "solution_unmarked") {
    if (!payload.commentId) {
      return NextResponse.json(
        { ok: false, error: "Missing commentId." },
        { status: 400 }
      )
    }
    if (!proposition.notify_solutions) return NextResponse.json({ ok: true })
    const { data: comment } = await supabase
      .from("comments")
      .select("id, user_id, users(email, username)")
      .eq("id", payload.commentId)
      .maybeSingle()
    const actionLabel =
      payload.type === "solution_marked"
        ? t("marked as a solution", "marqué comme solution")
        : t("unmarked as a solution", "retiré comme solution")
    const commenter = getUser(comment?.users)
    if (commenter?.email) {
      const subject = t(
        `Your comment was ${actionLabel}`,
        `Votre commentaire a été ${actionLabel}`
      )
      const message = t(
        `Your comment on ${proposition.title} was ${actionLabel}.`,
        `Votre commentaire sur ${proposition.title} a été ${actionLabel}.`
      )
      await notifyRecipient({
        email: commenter.email,
        subject,
        message,
        link: propositionUrl,
        html: `<p>${message}</p>
<p><a href="${propositionUrl}">${viewPropositionLabel}</a></p>`,
        type: payload.type,
        notificationTitle: propositionLabel,
        notificationBody:
          payload.type === "solution_marked"
            ? t(
                "A comment was marked as a solution.",
                "Un commentaire a été marqué comme solution."
              )
            : t(
                "A comment was unmarked as a solution.",
                "Un commentaire n'est plus marqué comme solution."
              ),
      })
    }
  }

  if (payload.type === "status_done") {
    if (!proposition.page_id) return NextResponse.json({ ok: true })
    const { data: page } = await supabase
      .from("pages")
      .select("owner_id, name")
      .eq("id", proposition.page_id)
      .maybeSingle()
    if (page?.owner_id && page.owner_id !== proposition.author_id) {
      if (author?.email) {
        const doneLabel =
          statusLabels[locale]?.Done ?? (locale === "fr" ? "Terminé" : "Done")
        const subject = t(
          `Status "${doneLabel}": ${proposition.title}`,
          `Statut "${doneLabel}" : ${proposition.title}`
        )
        const message = t(
          `Your proposition ${proposition.title} moved to ${doneLabel}.`,
          `Votre proposition ${proposition.title} est passée à ${doneLabel}.`
        )
        await notifyRecipient({
          email: author.email,
          subject,
          message,
          link: propositionUrl,
          html: `<p>${message}</p>
<p><a href="${propositionUrl}">${viewPropositionLabel}</a></p>`,
          type: payload.type,
          notificationTitle: propositionLabel,
          notificationBody: t(
            `Your proposition status changed to "${doneLabel}".`,
            `Le statut de votre proposition est passé à « ${doneLabel} ».`
          ),
        })
      }
    }

    const { data: subscribers } = await supabase
      .from("page_subscriptions")
      .select("user_id, users(email)")
      .eq("page_id", proposition.page_id)
    await Promise.allSettled(
      (subscribers ?? []).map(async (subscriber: { user_id: string; users: { email?: string | null } | { email?: string | null }[] | null }) => {
        const email = getUserEmail(subscriber.users)
        if (!email) return
        const subject = t(
          `New update: ${proposition.title}`,
          `Nouvelle mise à jour : ${proposition.title}`
        )
        const message = t(
          `A proposition linked to this page was marked Done.`,
          `Une proposition liée à cette page a été marquée comme terminée.`
        )
        await notifyRecipient({
          email,
          subject,
          message,
          link: propositionUrl,
          html: `<p>${message}</p>
<p><strong>${proposition.title}</strong></p>
<p><a href="${propositionUrl}">${viewPropositionLabel}</a></p>`,
          type: payload.type,
          notificationTitle:
            page?.name || propositionLabel,
          notificationBody: t(
            "A proposition linked to this page was marked as done.",
            "Une proposition liée à cette page a été marquée comme terminée."
          ),
        })
      })
    )
  }

  if (payload.type === "proposition_created_linked") {
    if (!proposition.page_id) return NextResponse.json({ ok: true })
    const { data: page } = await supabase
      .from("pages")
      .select("owner_id, name")
      .eq("id", proposition.page_id)
      .maybeSingle()
    if (!page?.owner_id) return NextResponse.json({ ok: true })
    const { data: owner } = await supabase
      .from("users")
      .select("email")
      .eq("id", page.owner_id)
      .maybeSingle()
    if (owner?.email) {
      const subject = t(
        "New proposition linked to your page",
        "Nouvelle proposition liée à votre page"
      )
      const notificationReason = t(
        "A new proposition has been added.",
        "Une nouvelle proposition a été ajoutée."
      )
      const notificationTitle = page.name || t("Page update", "Mise à jour de page")
      const message = t(
        `A new proposition was created on your page: ${proposition.title}.`,
        `Une nouvelle proposition a été créée sur votre page : ${proposition.title}.`
      )
      await notifyRecipient({
        email: owner.email,
        subject,
        message,
        link: propositionUrl,
        html: `<p>${message}</p>
<p><a href="${propositionUrl}">${viewPropositionLabel}</a></p>`,
        type: payload.type,
        notificationTitle,
        notificationBody: notificationReason,
      })
    }
  }

  if (payload.type === "status_change") {
    if (!payload.newStatus) {
      return NextResponse.json(
        { ok: false, error: "Missing newStatus." },
        { status: 400 }
      )
    }
    const { data: subscribers } = await supabase
      .from("proposition_subscriptions")
      .select("user_id, users(email)")
      .eq("proposition_id", proposition.id)
    const label =
      statusLabels[locale]?.[payload.newStatus] ?? payload.newStatus
    await Promise.allSettled(
      (subscribers ?? []).map(async (subscriber: { user_id: string; users: { email?: string | null } | { email?: string | null }[] | null }) => {
        const email = getUserEmail(subscriber.users)
        if (!email) return
        const subject = t(
          `Status change: ${proposition.title}`,
          `Changement de statut : ${proposition.title}`
        )
        const message = t(
          `The proposition ${proposition.title} moved to status "${label}".`,
          `La proposition ${proposition.title} est passée au statut « ${label} ».`
        )
        await notifyRecipient({
          email,
          subject,
          message,
          link: propositionUrl,
          html: `<p>${message}</p>
<p><a href="${propositionUrl}">${viewPropositionLabel}</a></p>`,
          type: payload.type,
          notificationTitle: propositionLabel,
          notificationBody: t(
            `Proposition status changed to "${label}".`,
            `Le statut de la proposition est passé à « ${label} ».`
          ),
        })
      })
    )
  }

  if (payload.type === "owner_vote_threshold") {
    if (!proposition.page_id) return NextResponse.json({ ok: true })
    const { data: page } = await supabase
      .from("pages")
      .select("owner_id, owner_notify_daily, owner_vote_threshold")
      .eq("id", proposition.page_id)
      .maybeSingle()
    if (!page?.owner_id || page.owner_notify_daily) {
      return NextResponse.json({ ok: true })
    }
    if (!page.owner_vote_threshold) {
      return NextResponse.json({ ok: true })
    }
    const { data: owner } = await supabase
      .from("users")
      .select("email")
      .eq("id", page.owner_id)
      .maybeSingle()
    if (owner?.email) {
      const subject = t(
        `Trending: ${proposition.title}`,
        `Tendance : ${proposition.title}`
      )
      const message = t(
        `The proposition ${proposition.title} reached the vote threshold.`,
        `La proposition ${proposition.title} a atteint le seuil de votes.`
      )
      await notifyRecipient({
        email: owner.email,
        subject,
        message,
        link: propositionUrl,
        html: `<p>${message}</p>
<p><a href="${propositionUrl}">${viewPropositionLabel}</a></p>`,
        type: payload.type,
        notificationTitle: propositionLabel,
        notificationBody: t(
          "The vote threshold has been reached.",
          "Le seuil de votes a été atteint."
        ),
      })
    }
  }

  return NextResponse.json({ ok: true })
}