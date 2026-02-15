import { notFound, redirect } from "next/navigation"
import { getSupabaseServerClient } from "@/utils/supabase/server"
import PropositionEditClient from "./proposition-edit-client"

type Props = {
  params: Promise<{ id: string }>
}

export default async function PropositionEditPage({ params }: Props) {
  const { id } = await params
  const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id
  )
  if (!isValidUuid) notFound()

  const supabase = await getSupabaseServerClient()
  if (!supabase) notFound()

  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) {
    redirect(`/login?next=/propositions/${id}/edit`)
  }

  const { data, error } = await supabase
    .from("propositions")
    .select("id, title, description, author_id, page_id, universe, category, sub_category, notify_comments, notify_volunteers, notify_solutions, image_urls")
    .eq("id", id)
    .single()

  if (error || !data) notFound()

  if (data.author_id !== userData.user.id) {
    redirect(`/propositions/${id}`)
  }

  let initialPage: { id: string; name: string; slug: string } | null = null
  if (data.page_id) {
    const { data: pageData } = await supabase
      .from("pages")
      .select("id, name, slug")
      .eq("id", data.page_id)
      .maybeSingle()
    initialPage = pageData ?? null
  }

  return (
    <PropositionEditClient
      propositionId={data.id}
      initialTitle={data.title ?? ""}
      initialDescription={data.description ?? ""}
      initialPage={initialPage}
      initialUniverse={(data.universe as string | null) ?? null}
      initialCategory={(data.category as string | null) ?? ""}
      initialSubCategory={(data.sub_category as string | null) ?? ""}
      initialNotifyComments={data.notify_comments ?? true}
      initialNotifyVolunteers={data.notify_volunteers ?? true}
      initialNotifySolutions={data.notify_solutions ?? true}
      initialImageUrls={(data.image_urls as { url: string; caption?: string }[] | null) ?? []}
    />
  )
}