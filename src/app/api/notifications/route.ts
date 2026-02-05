import { NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

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
  propositionId: string
  commentId?: string
  actorUserId?: string
  newStatus?: string
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

const createNotification = async ({
  supabase,
  email,
  type,
  title,
  body: content,
  link,
}: {
  supabase: SupabaseClient
  email: string
  type: NotificationPayload["type"]
  title: string
  body: string
  link: string
}) => {
  if (!email) return
  const { error } = await supabase.from("notifications").insert([
    {
      email,
      type,
      title,
      body: content,
      link,
    } as never,
  ])
  if (error) {
    throw new Error(error.message)
  }
}

export async function POST(request: Request) {
  let payload: NotificationPayload | null = null
  try {
    payload = (await request.json()) as NotificationPayload
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 })
  }
  if (!payload?.type || !payload.propositionId) {
    return NextResponse.json(
      { ok: false, error: "Missing notification payload." },
      { status: 400 }
    )
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
  const supabase = createClient(url, anonKey)

  const safeSendEmail = async (args: Parameters<typeof sendEmail>[0]) => {
    try {
      await sendEmail(args)
    } catch (error) {
      console.error("Failed to send email", error)
    }
  }

  const safeCreateNotification = async (
    args: Parameters<typeof createNotification>[0]
  ) => {
    try {
      await createNotification(args)
    } catch (error) {
      console.error("Failed to create notification", error)
    }
  }

  const { data: proposition, error: propositionError } = await supabase
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

  const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL
  const appUrl =
    rawAppUrl && rawAppUrl.startsWith("http")
      ? rawAppUrl
      : "https://www.forom.app"
  const propositionUrl = `${appUrl}/propositions/${proposition.id}`

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
      const subject = `Nouveau commentaire: ${proposition.title}`
      const message = `Un nouveau commentaire a été posté sur ${proposition.title}.`
      await safeSendEmail({
        to: author.email,
        subject,
        html: `<p>${message}</p>
<p>Auteur: ${
          commenter?.username || commenter?.email || "Anonyme"
        }</p>
<p>${comment.content}</p>
<p><a href="${propositionUrl}">Voir la proposition</a></p>`,
      })
      await safeCreateNotification({
        supabase,
        email: author.email,
        type: payload.type,
        title: subject,
        body: message,
        link: propositionUrl,
      })
    }
  }

  if (payload.type === "volunteer_created") {
    if (!proposition.notify_volunteers) return NextResponse.json({ ok: true })
    if (proposition.page_id) return NextResponse.json({ ok: true })
    if (author?.email) {
      const subject = `Nouveau volontaire: ${proposition.title}`
      const message = `Un utilisateur s’est déclaré volontaire pour ${proposition.title}.`
      await safeSendEmail({
        to: author.email,
        subject,
        html: `<p>${message}</p>
<p><a href="${propositionUrl}">Voir la proposition</a></p>`,
      })
      await safeCreateNotification({
        supabase,
        email: author.email,
        type: payload.type,
        title: subject,
        body: message,
        link: propositionUrl,
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
        ? "marquée comme solution"
        : "retirée comme solution"
    const commenter = getUser(comment?.users)
    if (commenter?.email) {
      const subject = `Votre commentaire a été ${actionLabel}`
      const message = `Votre commentaire sur ${proposition.title} a été ${actionLabel}.`
      await safeSendEmail({
        to: commenter.email,
        subject,
        html: `<p>${message}</p>
<p><a href="${propositionUrl}">Voir la proposition</a></p>`,
      })
      await safeCreateNotification({
        supabase,
        email: commenter.email,
        type: payload.type,
        title: subject,
        body: message,
        link: propositionUrl,
      })
    }
  }

  if (payload.type === "status_done") {
    if (!proposition.page_id) return NextResponse.json({ ok: true })
    const { data: page } = await supabase
      .from("pages")
      .select("owner_id")
      .eq("id", proposition.page_id)
      .maybeSingle()
    if (page?.owner_id && page.owner_id !== proposition.author_id) {
      if (author?.email) {
        const subject = `Statut “Done”: ${proposition.title}`
        const message = `Votre proposition ${proposition.title} est passée en statut Done.`
        await safeSendEmail({
          to: author.email,
          subject,
          html: `<p>${message}</p>
<p><a href="${propositionUrl}">Voir la proposition</a></p>`,
        })
        await safeCreateNotification({
          supabase,
          email: author.email,
          type: payload.type,
          title: subject,
          body: message,
          link: propositionUrl,
        })
      }
    }

    const { data: subscribers } = await supabase
      .from("page_subscriptions")
      .select("user_id, users(email)")
      .eq("page_id", proposition.page_id)
    for (const subscriber of subscribers ?? []) {
      const email = getUserEmail(subscriber.users)
      if (email) {
        const subject = `Nouvelle mise à jour: ${proposition.title}`
        const message = `Une proposition liée à cette page vient d’être marquée comme Done.`
        await safeSendEmail({
          to: email,
          subject,
          html: `<p>${message}</p>
<p><strong>${proposition.title}</strong></p>
<p><a href="${propositionUrl}">Voir la proposition</a></p>`,
        })
        await safeCreateNotification({
          supabase,
          email,
          type: payload.type,
          title: subject,
          body: message,
          link: propositionUrl,
        })
      }
    }
  }

  if (payload.type === "proposition_created_linked") {
    if (!proposition.page_id) return NextResponse.json({ ok: true })
    const { data: page } = await supabase
      .from("pages")
      .select("owner_id")
      .eq("id", proposition.page_id)
      .maybeSingle()
    if (!page?.owner_id) return NextResponse.json({ ok: true })
    const { data: owner } = await supabase
      .from("users")
      .select("email")
      .eq("id", page.owner_id)
      .maybeSingle()
    if (owner?.email) {
      const subject = `Nouvelle proposition liée à votre page`
      const message = `Une nouvelle proposition a été créée sur votre page: ${proposition.title}.`
      await safeSendEmail({
        to: owner.email,
        subject,
        html: `<p>${message}</p>
<p><a href="${propositionUrl}">Voir la proposition</a></p>`,
      })
      await safeCreateNotification({
        supabase,
        email: owner.email,
        type: payload.type,
        title: subject,
        body: message,
        link: propositionUrl,
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
    const statusLabel: Record<string, string> = {
      Open: "Ouvert",
      Done: "Terminé",
      "Won't Do": "Ne sera pas fait",
      "In Progress": "En cours",
    }
    const label = statusLabel[payload.newStatus] ?? payload.newStatus
    for (const subscriber of subscribers ?? []) {
      const email = getUserEmail(subscriber.users)
      if (email) {
        const subject = `Changement de statut: ${proposition.title}`
        const message = `La proposition ${proposition.title} est passée en statut « ${label} ».`
        await safeSendEmail({
          to: email,
          subject,
          html: `<p>${message}</p>
<p><a href="${propositionUrl}">Voir la proposition</a></p>`,
        })
        await safeCreateNotification({
          supabase,
          email,
          type: payload.type,
          title: subject,
          body: message,
          link: propositionUrl,
        })
      }
    }
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
      const subject = `Tendance: ${proposition.title}`
      const message = `La proposition ${proposition.title} a atteint le seuil de votes.`
      await safeSendEmail({
        to: owner.email,
        subject,
        html: `<p>${message}</p>
<p><a href="${propositionUrl}">Voir la proposition</a></p>`,
      })
      await safeCreateNotification({
        supabase,
        email: owner.email,
        type: payload.type,
        title: subject,
        body: message,
        link: propositionUrl,
      })
    }
  }

  return NextResponse.json({ ok: true })
}
