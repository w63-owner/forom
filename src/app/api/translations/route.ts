import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/utils/supabase/server"
import { validateMutationOrigin } from "@/lib/security/origin-guard"
import { applyRateLimit } from "@/lib/api-rate-limit"
import { translateText } from "@/lib/translations/deepl-client"

export const dynamic = "force-dynamic"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const ALLOWED_TABLES = ["propositions", "comments"] as const
type AllowedTable = (typeof ALLOWED_TABLES)[number]

const ALLOWED_FIELDS: Record<AllowedTable, string[]> = {
  propositions: ["title", "description"],
  comments: ["content"],
}

const HTML_FIELDS = new Set(["description"])

const ALLOWED_LANGS = ["fr", "en"] as const
const DEEPL_LANG_MAP: Record<string, "FR" | "EN"> = { fr: "FR", en: "EN" }

type TranslateBody = {
  sourceTable?: string
  sourceId?: string
  fields?: string[]
  targetLang?: string
}

export async function POST(request: Request) {
  const originCheck = validateMutationOrigin(request)
  if (!originCheck.ok) {
    return NextResponse.json(
      { ok: false, error: originCheck.reason ?? "Forbidden." },
      { status: 403 }
    )
  }

  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Service unavailable." },
      { status: 500 }
    )
  }

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 }
    )
  }

  const rateLimited = applyRateLimit(request, "translations", authData.user.id)
  if (rateLimited) return rateLimited

  let body: TranslateBody
  try {
    body = (await request.json()) as TranslateBody
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON." },
      { status: 400 }
    )
  }

  const sourceTable = body.sourceTable?.trim() ?? ""
  const sourceId = body.sourceId?.trim() ?? ""
  const fields = body.fields ?? []
  const targetLang = body.targetLang?.trim() ?? ""

  if (!ALLOWED_TABLES.includes(sourceTable as AllowedTable)) {
    return NextResponse.json(
      { ok: false, error: "Invalid sourceTable." },
      { status: 400 }
    )
  }
  if (!UUID_PATTERN.test(sourceId)) {
    return NextResponse.json(
      { ok: false, error: "Invalid sourceId." },
      { status: 400 }
    )
  }
  if (!ALLOWED_LANGS.includes(targetLang as (typeof ALLOWED_LANGS)[number])) {
    return NextResponse.json(
      { ok: false, error: "Invalid targetLang." },
      { status: 400 }
    )
  }

  const allowedFields = ALLOWED_FIELDS[sourceTable as AllowedTable] ?? []
  const validFields = fields.filter((f) => allowedFields.includes(f))
  if (validFields.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No valid fields." },
      { status: 400 }
    )
  }

  // --- Cache lookup ---
  const { data: cached } = await supabase
    .from("translations")
    .select("source_field, translated_text")
    .eq("source_table", sourceTable)
    .eq("source_id", sourceId)
    .eq("target_lang", targetLang)
    .in("source_field", validFields)

  const cachedMap = new Map(
    (cached ?? []).map((row: { source_field: string; translated_text: string }) => [
      row.source_field,
      row.translated_text,
    ])
  )

  const missingFields = validFields.filter((f) => !cachedMap.has(f))

  if (missingFields.length === 0) {
    return NextResponse.json({
      ok: true,
      translations: Object.fromEntries(cachedMap),
      cached: true,
    })
  }

  // --- Fetch source content for uncached fields ---
  const selectCols = missingFields.join(", ")
  const { data: sourceRow, error: sourceError } = await supabase
    .from(sourceTable)
    .select(selectCols)
    .eq("id", sourceId)
    .maybeSingle()

  if (sourceError || !sourceRow) {
    return NextResponse.json(
      { ok: false, error: "Source content not found." },
      { status: 404 }
    )
  }

  // --- Translate each missing field via DeepL ---
  const deepLTarget = DEEPL_LANG_MAP[targetLang]
  if (!deepLTarget) {
    return NextResponse.json(
      { ok: false, error: "Unsupported target language." },
      { status: 400 }
    )
  }

  const newTranslations: Record<string, string> = {}

  for (const field of missingFields) {
    const sourceText = (sourceRow as Record<string, string | null>)[field]
    if (!sourceText?.trim()) {
      newTranslations[field] = ""
      continue
    }

    try {
      const { translatedText, detectedSourceLang } = await translateText({
        text: sourceText,
        targetLang: deepLTarget,
        isHtml: HTML_FIELDS.has(field),
      })

      if (detectedSourceLang === targetLang) {
        newTranslations[field] = sourceText
        continue
      }

      newTranslations[field] = translatedText

      void supabase.from("translations").upsert(
        {
          source_table: sourceTable,
          source_id: sourceId,
          source_field: field,
          source_lang: detectedSourceLang,
          target_lang: targetLang,
          translated_text: translatedText,
          char_count: sourceText.length,
        },
        { onConflict: "source_table,source_id,source_field,target_lang" }
      )
    } catch (err) {
      return NextResponse.json(
        {
          ok: false,
          error: err instanceof Error ? err.message : "Translation failed.",
        },
        { status: 502 }
      )
    }
  }

  return NextResponse.json({
    ok: true,
    translations: {
      ...Object.fromEntries(cachedMap),
      ...newTranslations,
    },
    cached: false,
  })
}
