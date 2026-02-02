import Link from "next/link"
import { AuthStatus } from "@/components/auth-status"
import { Button } from "@/components/ui/button"
import { Omnibar } from "@/components/omnibar"

export default function Home() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-background via-muted/30 to-muted/60 px-6 py-16">
      <div className="absolute inset-x-0 top-6 flex justify-start px-6">
        <Button asChild size="sm" variant="ghost">
          <Link href="/explore">Explorer</Link>
        </Button>
      </div>
      <div className="absolute right-6 top-6">
        <AuthStatus />
      </div>
      <main className="flex w-full max-w-3xl flex-col items-center gap-6 text-center">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Change
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Cherchez, votez, construisez ensemble.
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            Décrivez une idée et voyez instantanément si elle existe déjà.
          </p>
        </div>
        <Omnibar />
      </main>
    </div>
  )
}
