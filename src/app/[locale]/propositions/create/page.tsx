import { use } from "react"
import CreatePropositionClient from "./proposition-client"

type Props = {
  searchParams: Promise<{
    title?: string | string[]
    page?: string | string[]
    pageName?: string | string[]
  }>
}

export default function CreatePropositionPage({ searchParams }: Props) {
  const resolvedSearchParams = use(searchParams)
  const titleParam = resolvedSearchParams.title
  const pageParam = resolvedSearchParams.page
  const pageNameParam = resolvedSearchParams.pageName

  const initialTitle = Array.isArray(titleParam) ? titleParam[0] ?? "" : titleParam ?? ""
  const initialPageIdOrSlug = Array.isArray(pageParam) ? pageParam[0] ?? "" : pageParam ?? ""
  const initialPageName = Array.isArray(pageNameParam)
    ? pageNameParam[0] ?? ""
    : pageNameParam ?? ""

  return (
    <CreatePropositionClient
      initialTitle={initialTitle}
      initialPageSlug={initialPageIdOrSlug}
      initialPageName={initialPageName}
    />
  )
}