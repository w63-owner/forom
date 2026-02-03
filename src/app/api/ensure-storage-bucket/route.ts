import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const BUCKET_ID = "proposition-images"

export async function POST() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY manquant. Ajoutez-la dans .env.local pour créer le bucket automatiquement, ou créez le bucket « proposition-images » dans Supabase (Storage → New bucket, public).",
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
