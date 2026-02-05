import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = (searchParams.get("q") ?? "").trim()
  if (!query) {
    return NextResponse.json({ data: [] })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return NextResponse.json(
      { error: "Supabase non configuré." },
      { status: 500 }
    )
  }

  const supabase = createClient(url, anonKey)
  const { data, error } = await supabase
    .from("pages")
    .select("id, name, slug")
    .ilike("name", `%${query}%`)
    .order("name", { ascending: true })
    .limit(5)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}
