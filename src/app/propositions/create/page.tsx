import { use } from "react"
import CreatePropositionClient from "./proposition-client"

type Props = {
  searchParams: Promise<{ title?: string | string[] }>
}

export default function CreatePropositionPage({ searchParams }: Props) {
  const resolvedSearchParams = use(searchParams)
  const titleParam = resolvedSearchParams.title
  const initialTitle = Array.isArray(titleParam) ? titleParam[0] ?? "" : titleParam ?? ""

  return <CreatePropositionClient initialTitle={initialTitle} />
}
