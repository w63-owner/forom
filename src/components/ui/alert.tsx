"use client"

import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type AlertVariant = "default" | "success" | "error" | "info" | "warning"

type AlertProps = {
  variant?: AlertVariant
  title?: string
  children?: ReactNode
  className?: string
}

export function Alert({ variant = "default", title, children, className }: AlertProps) {
  const Icon =
    variant === "success"
      ? CheckCircle2
      : variant === "error"
      ? XCircle
      : variant === "warning"
      ? AlertTriangle
      : Info

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md border px-3 py-2 text-sm",
        "bg-card text-foreground border-border",
        variant === "success" && "border-emerald-500/50 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
        variant === "error" && "border-destructive/60 bg-destructive/5 text-destructive dark:bg-destructive/15",
        variant === "info" && "border-sky-500/50 bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-100",
        variant === "warning" && "border-amber-500/60 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
        className
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="space-y-0.5">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="text-xs text-muted-foreground">{children}</div>}
      </div>
    </div>
  )
}
