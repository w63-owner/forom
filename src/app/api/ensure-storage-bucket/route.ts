import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/utils/supabase/server"
import { validateMutationOrigin } from "@/lib/security/origin-guard"

export const dynamic = "force-dynamic"

const BUCKET_ID = "proposition-images"

export async function POST(request: Request) {
  const originValidation = validateMutationOrigin(request)
  if (!originValidation.ok) {
    return NextResponse.json(
      {
        error:
          originValidation.reason ??
          "Forbidden origin.",
      },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const locale = searchParams.get("locale") === "fr" ? "fr" : "en"
  const t = (en: string, fr: string) => (locale === "fr" ? fr : en)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const sessionSupabase = await getSupabaseServerClient()
  if (!sessionSupabase) {
    return NextResponse.json(
      { error: t("Supabase not configured.", "Supabase non configuré.") },
      { status: 500 }
    )
  }
  const { data: userData } = await sessionSupabase.auth.getUser()
  if (!userData.user) {
    return NextResponse.json(
      { error: t("Unauthorized.", "Non autorisé.") },
      { status: 401 }
    )
  }

  if (!url || !serviceRoleKey) {
    return NextResponse.json(
      {
        error: t(
          'SUPABASE_SERVICE_ROLE_KEY missing. Add it to .env.local to create the bucket automatically, or create the "proposition-images" bucket in Supabase (Storage → New bucket, public).',
          'SUPABASE_SERVICE_ROLE_KEY manquante. Ajoutez-la à .env.local pour créer automatiquement le bucket, ou créez le bucket "proposition-images" dans Supabase (Storage → New bucket, public).'
        ),
      },
      { status: 503 }
    )
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const { data: buckets } = await supabase.storage.listBuckets()
  const exists = buckets?.some((b) => b.name === BUCKET_ID)

  if (exists) {
    return NextResponse.json({ ok: true, created: false })
  }

  const { error } = await supabase.storage.createBucket(BUCKET_ID, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024, // 5 MB
    allowedMimeTypes: ["image/png", "image/jpeg", "image/jpg"],
  })

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true, created: true })
}