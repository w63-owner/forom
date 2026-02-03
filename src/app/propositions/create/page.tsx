import { use } from "react"
import CreatePropositionClient from "./proposition-client"

type Props = {
  searchParams: Promise<{ title?: string | string[]; page?: string | string[] }>
}

export default function CreatePropositionPage({ searchParams }: Props) {
  const resolvedSearchParams = use(searchParams)
  const titleParam = resolvedSearchParams.title
  const pageParam = resolvedSearchParams.page
  const initialTitle = Array.isArray(titleParam) ? titleParam[0] ?? "" : titleParam ?? ""
  const initialPageSlug = Array.isArray(pageParam) ? pageParam[0] ?? "" : pageParam ?? ""

  return (
    <CreatePropositionClient
      initialTitle={initialTitle}
      initialPageSlug={initialPageSlug}
    />
  )
}
