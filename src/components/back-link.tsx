"use client"

import { useRouter } from "next/navigation"

type Props = {
  className?: string
  label?: string
}

export function BackLink({ className, label = "← Retour" }: Props) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={className}
    >
      {label}
    </button>
  )
}
