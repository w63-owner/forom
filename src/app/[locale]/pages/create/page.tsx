import { Suspense } from "react"
import { CreatePageClient } from "./create-page-client"

export default function CreatePage() {
  return (
    <Suspense>
      <CreatePageClient />
    </Suspense>
  )
}