import { setRequestLocale } from "next-intl/server"

type Props = { params: Promise<{ locale: string }> }

export default async function DraftPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <main>
      <iframe
        src="https://www.forom.app/fr/embed/pages/forom/propositions?theme=light&limit=10&sort=top&bg=%23f8fafc&header=%23f1f5f9&avatars=0&v=1771941644730"
        width="100%"
        height="640"
        style={{ border: 0 }}
        loading="lazy"
      />
    </main>
  )
}
