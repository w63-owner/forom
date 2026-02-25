"use client"

type ToggleSwitchProps = {
  id: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  ariaLabelledBy?: string
  ariaLabel?: string
  className?: string
}

export function ToggleSwitch({
  id,
  checked,
  onCheckedChange,
  ariaLabelledBy,
  ariaLabel,
  className,
}: ToggleSwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={ariaLabelledBy}
      aria-label={ariaLabel}
      onClick={() => onCheckedChange(!checked)}
      className={`focus-ring relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
        checked
          ? "border-emerald-500/70 bg-emerald-500/25"
          : "border-border bg-muted/60"
      } ${className ?? ""}`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-background shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  )
}
