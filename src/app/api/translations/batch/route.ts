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

const MAX_ITEMS = 50

type BatchItem = {
  sourceTable?: string
  sourceId?: string
  fields?: string[]
}

type BatchBody = {
  items?: BatchItem[]
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

  const rateLimited = applyRateLimit(request, "translations/batch", authData.user.id)
  if (rateLimited) return rateLimited

  let body: BatchBody
  try {
    body = (await request.json()) as BatchBody
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON." },
      { status: 400 }
    )
  }

  const targetLang = body.targetLang?.trim() ?? ""
  if (!ALLOWED_LANGS.includes(targetLang as (typeof ALLOWED_LANGS)[number])) {
    return NextResponse.json(
      { ok: false, error: "Invalid targetLang." },
      { status: 400 }
    )
  }

  const rawItems = body.items ?? []
  if (rawItems.length === 0) {
    return NextResponse.json({ ok: true, translations: {} })
  }
  if (rawItems.length > MAX_ITEMS) {
    return NextResponse.json(
      { ok: false, error: `Too many items. Max ${MAX_ITEMS}.` },
      { status: 400 }
    )
  }

  // Validate and normalize items
  type ValidItem = {
    sourceTable: AllowedTable
    sourceId: string
    fields: string[]
  }

  const validItems: ValidItem[] = []
  for (const item of rawItems) {
    const sourceTable = item.sourceTable?.trim() ?? ""
    const sourceId = item.sourceId?.trim() ?? ""
    const fields = item.fields ?? []

    if (!ALLOWED_TABLES.includes(sourceTable as AllowedTable)) continue
    if (!UUID_PATTERN.test(sourceId)) continue

    const allowedFields = ALLOWED_FIELDS[sourceTable as AllowedTable] ?? []
    const validFields = fields.filter((f) => allowedFields.includes(f))
    if (validFields.length === 0) continue

    validItems.push({
      sourceTable: sourceTable as AllowedTable,
      sourceId,
      fields: validFields,
    })
  }

  if (validItems.length === 0) {
    return NextResponse.json({ ok: true, translations: {} })
  }

  // Group by table for efficient DB queries
  const byTable = new Map<AllowedTable, ValidItem[]>()
  for (const item of validItems) {
    const group = byTable.get(item.sourceTable) ?? []
    group.push(item)
    byTable.set(item.sourceTable, group)
  }

  // Result map: sourceId -> field -> translatedText
  const result: Record<string, Record<string, string>> = {}

  const deepLTarget = DEEPL_LANG_MAP[targetLang]
  if (!deepLTarget) {
    return NextResponse.json(
      { ok: false, error: "Unsupported target language." },
      { status: 400 }
    )
  }

  for (const [sourceTable, tableItems] of byTable) {
    const ids = tableItems.map((i) => i.sourceId)
    const allFields = [...new Set(tableItems.flatMap((i) => i.fields))]

    // --- Batch cache lookup ---
    const { data: cached } = await supabase
      .from("translations")
      .select("source_id, source_field, translated_text")
      .eq("source_table", sourceTable)
      .eq("target_lang", targetLang)
      .in("source_id", ids)
      .in("source_field", allFields)

    // Index cached results: sourceId -> field -> text
    const cacheIndex = new Map<string, Map<string, string>>()
    for (const row of cached ?? []) {
      const byId = cacheIndex.get(row.source_id) ?? new Map<string, string>()
      byId.set(row.source_field, row.translated_text)
      cacheIndex.set(row.source_id, byId)
    }

    // Populate result from cache
    for (const item of tableItems) {
      const cachedFields = cacheIndex.get(item.sourceId)
      if (cachedFields) {
        for (const [field, text] of cachedFields) {
          if (item.fields.includes(field)) {
            result[item.sourceId] ??= {}
            result[item.sourceId][field] = text
          }
        }
      }
    }

    // Find items/fields missing from cache
    const missingItems = tableItems
      .map((item) => ({
        ...item,
        missingFields: item.fields.filter(
          (f) => !(cacheIndex.get(item.sourceId)?.has(f))
        ),
      }))
      .filter((item) => item.missingFields.length > 0)

    if (missingItems.length === 0) continue

    // Fetch source content for all missing items in one query
    const missingIds = missingItems.map((i) => i.sourceId)
    const missingFields = [...new Set(missingItems.flatMap((i) => i.missingFields))]
    const selectCols = ["id", ...missingFields].join(", ")

    const { data: sourceRows } = await supabase
      .from(sourceTable)
      .select(selectCols)
      .in("id", missingIds)

    if (!sourceRows || sourceRows.length === 0) continue

    const sourceIndex = new Map(
      (sourceRows as Array<Record<string, unknown>>).map((row) => [
        row.id as string,
        row,
      ])
    )

    // Translate each missing item/field
    for (const item of missingItems) {
      const sourceRow = sourceIndex.get(item.sourceId)
      if (!sourceRow) continue

      for (const field of item.missingFields) {
        const sourceText = sourceRow[field] as string | null
        if (!sourceText?.trim()) {
          result[item.sourceId] ??= {}
          result[item.sourceId][field] = ""
          continue
        }

        try {
          const { translatedText, detectedSourceLang } = await translateText({
            text: sourceText,
            targetLang: deepLTarget,
            isHtml: HTML_FIELDS.has(field),
          })

          result[item.sourceId] ??= {}

          if (detectedSourceLang === targetLang) {
            // Same language — mark as sameLanguage sentinel, do not cache
            result[item.sourceId][field] = sourceText
            continue
          }

          result[item.sourceId][field] = translatedText

          void supabase.from("translations").upsert(
            {
              source_table: sourceTable,
              source_id: item.sourceId,
              source_field: field,
              source_lang: detectedSourceLang,
              target_lang: targetLang,
              translated_text: translatedText,
              char_count: sourceText.length,
            },
            { onConflict: "source_table,source_id,source_field,target_lang" }
          )
        } catch {
          // On DeepL error for a single item, skip it gracefully — original will be shown
        }
      }
    }
  }

  return NextResponse.json({ ok: true, translations: result })
}
