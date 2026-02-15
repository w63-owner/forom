import { Suspense } from "react"
import LoginPageClient from "./login-page-client"

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-muted/40 px-6 py-16" />}>
      <LoginPageClient />
    </Suspense>
  )
}