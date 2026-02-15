"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

type Step = {
  title: string
  body: string
}

type FaqItem = {
  question: string
  answer: string
}

type Props = {
  heading: string
  steps: Step[]
  faqHeading?: string
  faqs?: FaqItem[]
}

export function HowItWorksStepper({ heading, steps, faqHeading, faqs }: Props) {
  const [activeStep, setActiveStep] = useState(0)

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{heading}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => {
            const active = index === activeStep
            return (
              <button
                key={step.title}
                type="button"
                onClick={() => setActiveStep(index)}
                className={[
                  "rounded-xl border p-4 text-left transition-colors",
                  active
                    ? "border-sky-500/60 bg-sky-50 dark:border-sky-500/50 dark:bg-sky-950/30"
                    : "border-border bg-background hover:bg-muted/60",
                ].join(" ")}
              >
                <div
                  className={[
                    "mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold",
                    active
                      ? "border-sky-500/60 bg-sky-100 text-sky-700 dark:border-sky-500/50 dark:bg-sky-950/40 dark:text-sky-200"
                      : "border-border text-muted-foreground",
                  ].join(" ")}
                >
                  {index + 1}
                </div>
                <p
                  className={[
                    "text-sm font-semibold",
                    active ? "text-sky-900 dark:text-sky-100" : "text-foreground",
                  ].join(" ")}
                >
                  {step.title}
                </p>
              </button>
            )
          })}
        </div>
        <div className="rounded-xl border border-sky-500/50 bg-sky-50/70 p-5 text-sm text-sky-900 dark:border-sky-500/40 dark:bg-sky-950/25 dark:text-sky-100">
          <p className="font-semibold">{steps[activeStep]?.title}</p>
          <p className="mt-2 text-sky-800/90 dark:text-sky-100/90">{steps[activeStep]?.body}</p>
        </div>
      </section>

      {faqHeading && faqs && faqs.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">{faqHeading}</h2>
          <div className="rounded-xl border border-border bg-background">
            {faqs.map((item) => (
              <details
                key={item.question}
                className="group border-b border-border/70 px-4 py-3 last:border-b-0"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-foreground">
                  <span>{item.question}</span>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}