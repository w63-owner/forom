import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

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
  await fetch("https://api.resend.com/emails", {
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
}

export async function POST(request: Request) {
  const body = (await request.json()) as NotificationPayload
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
  const supabase = createClient(url, anonKey)

  const { data: proposition } = await supabase
    .from("propositions")
    .select(
      "id, title, author_id, page_id, notify_comments, notify_volunteers, notify_solutions"
    )
    .eq("id", body.propositionId)
    .maybeSingle()

  if (!proposition) {
    return NextResponse.json({ ok: true })
  }

  const { data: author } = await supabase
    .from("users")
    .select("email, username")
    .eq("id", proposition.author_id)
    .maybeSingle()

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

  if (body.type === "comment_created" && body.commentId) {
    if (!proposition.notify_comments) return NextResponse.json({ ok: true })
    const { data: comment } = await supabase
      .from("comments")
      .select("id, content, user_id, users(username, email)")
      .eq("id", body.commentId)
      .maybeSingle()
    if (author?.email && comment) {
      const commenter = getUser(comment.users)
      await sendEmail({
        to: author.email,
        subject: `Nouveau commentaire: ${proposition.title}`,
        html: `<p>Un nouveau commentaire a été posté sur <strong>${proposition.title}</strong>.</p>
<p>Auteur: ${
          commenter?.username || commenter?.email || "Anonyme"
        }</p>
<p>${comment.content}</p>
<p><a href="${propositionUrl}">Voir la proposition</a></p>`,
      })
    }
  }

  if (body.type === "volunteer_created") {
    if (!proposition.notify_volunteers) return NextResponse.json({ ok: true })
    if (proposition.page_id) return NextResponse.json({ ok: true })
    if (author?.email) {
      await sendEmail({
        to: author.email,
        subject: `Nouveau volontaire: ${proposition.title}`,
        html: `<p>Un utilisateur s’est déclaré volontaire pour <strong>${proposition.title}</strong>.</p>
<p><a href="${propositionUrl}">Voir la proposition</a></p>`,
      })
    }
  }

  if (
    (body.type === "solution_marked" || body.type === "solution_unmarked") &&
    body.commentId
  ) {
    if (!proposition.notify_solutions) return NextResponse.json({ ok: true })
    const { data: comment } = await supabase
      .from("comments")
      .select("id, user_id, users(email, username)")
      .eq("id", body.commentId)
      .maybeSingle()
    const actionLabel =
      body.type === "solution_marked"
        ? "marquée comme solution"
        : "retirée comme solution"
    const commenter = getUser(comment?.users)
    if (commenter?.email) {
      await sendEmail({
        to: commenter.email,
        subject: `Votre commentaire a été ${actionLabel}`,
        html: `<p>Votre commentaire sur <strong>${proposition.title}</strong> a été ${actionLabel}.</p>
<p><a href="${propositionUrl}">Voir la proposition</a></p>`,
      })
    }
  }

  if (body.type === "status_done") {
    if (!proposition.page_id) return NextResponse.json({ ok: true })
    const { data: page } = await supabase
      .from("pages")
      .select("owner_id")
      .eq("id", proposition.page_id)
      .maybeSingle()
    if (page?.owner_id && page.owner_id !== proposition.author_id) {
      if (author?.email) {
        await sendEmail({
          to: author.email,
          subject: `Statut “Done”: ${proposition.title}`,
          html: `<p>Votre proposition <strong>${proposition.title}</strong> est passée en statut Done.</p>
<p><a href="${propositionUrl}">Voir la proposition</a></p>`,
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
        await sendEmail({
          to: email,
          subject: `Nouvelle mise à jour: ${proposition.title}`,
          html: `<p>Une proposition liée à cette page vient d’être marquée comme Done.</p>
<p><strong>${proposition.title}</strong></p>
<p><a href="${propositionUrl}">Voir la proposition</a></p>`,
        })
      }
    }
  }

  if (body.type === "proposition_created_linked") {
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
      await sendEmail({
        to: owner.email,
        subject: `Nouvelle proposition liée à votre page`,
        html: `<p>Une nouvelle proposition a été créée sur votre page.</p>
<p><strong>${proposition.title}</strong></p>
<p><a href="${propositionUrl}">Voir la proposition</a></p>`,
      })
    }
  }

  if (body.type === "status_change" && body.newStatus) {
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
    const label = statusLabel[body.newStatus] ?? body.newStatus
    for (const subscriber of subscribers ?? []) {
      const email = getUserEmail(subscriber.users)
      if (email) {
        await sendEmail({
          to: email,
          subject: `Changement de statut: ${proposition.title}`,
          html: `<p>La proposition <strong>${proposition.title}</strong> est passée en statut « ${label} ».</p>
<p><a href="${propositionUrl}">Voir la proposition</a></p>`,
        })
      }
    }
  }

  if (body.type === "owner_vote_threshold") {
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
      await sendEmail({
        to: owner.email,
        subject: `Tendance: ${proposition.title}`,
        html: `<p>La proposition <strong>${proposition.title}</strong> a atteint le seuil de votes.</p>
<p><a href="${propositionUrl}">Voir la proposition</a></p>`,
      })
    }
  }

  return NextResponse.json({ ok: true })
}
