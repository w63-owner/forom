"use client"

import { Triangle } from "lucide-react"

type Props = {
  votes: number
  hasVoted: boolean
  loading: boolean
  onClick: () => void
  ariaLabel: string
}

export function PropositionVoteButton({
  votes,
  hasVoted,
  loading,
  onClick,
  ariaLabel,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label={ariaLabel}
      aria-busy={loading}
      className={[
        "focus-ring group inline-flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-xl border-2 bg-background px-1.5 py-1.5 text-xs font-semibold transition-colors transition-transform duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 md:h-11 md:w-11",
        hasVoted
          ? "border-emerald-500/40 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-500/50 dark:bg-emerald-950/30 dark:text-emerald-100 dark:hover:bg-emerald-950/40"
          : "border-border text-foreground hover:border-emerald-400/50 hover:bg-emerald-50/40 dark:hover:border-emerald-500/60 dark:hover:bg-emerald-950/20",
      ].join(" ")}
    >
      <Triangle
        className={[
          "size-2.5 transition-colors",
          hasVoted
            ? "fill-emerald-500 text-emerald-500"
            : "fill-transparent text-muted-foreground group-hover:fill-emerald-500/20 group-hover:text-emerald-500",
        ].join(" ")}
      />
      <span
        className={[
          "text-[1.25rem] leading-none tracking-tight md:text-[1.125rem]",
          hasVoted
            ? "text-emerald-900 dark:text-emerald-100"
            : "text-foreground group-hover:text-emerald-900 dark:group-hover:text-emerald-200",
        ].join(" ")}
      >
        {votes}
      </span>
    </button>
  )
}