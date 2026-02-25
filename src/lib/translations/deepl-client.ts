type TranslateParams = {
  text: string
  targetLang: "FR" | "EN"
  sourceLang?: "FR" | "EN"
  isHtml?: boolean
}

type TranslateResult = {
  translatedText: string
  detectedSourceLang: string
}

type DeepLTranslation = {
  detected_source_language: string
  text: string
}

type DeepLResponse = {
  translations: DeepLTranslation[]
}

const DEEPL_API_URL = "https://api-free.deepl.com/v2/translate"

export async function translateText(
  params: TranslateParams
): Promise<TranslateResult> {
  const apiKey = process.env.DEEPL_API_KEY
  if (!apiKey) throw new Error("DEEPL_API_KEY is not configured.")

  const body = new URLSearchParams({
    text: params.text,
    target_lang: params.targetLang,
    ...(params.sourceLang ? { source_lang: params.sourceLang } : {}),
    ...(params.isHtml ? { tag_handling: "html" } : {}),
  })

  const response = await fetch(DEEPL_API_URL, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  })

  if (response.status === 429) {
    throw new Error("DeepL rate limit exceeded. Please try again later.")
  }
  if (response.status === 456) {
    throw new Error("DeepL translation quota exceeded.")
  }
  if (!response.ok) {
    throw new Error(`DeepL translation error: ${response.status}`)
  }

  const data = (await response.json()) as DeepLResponse
  const first = data.translations[0]
  if (!first) throw new Error("DeepL returned empty translations.")

  return {
    translatedText: first.text,
    detectedSourceLang: first.detected_source_language.toLowerCase(),
  }
}
