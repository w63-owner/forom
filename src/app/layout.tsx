import type { Metadata } from "next"
import { headers } from "next/headers"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { ToastProvider } from "@/components/ui/toast"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.startsWith("http")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "https://www.forom.app"
const description = "Plateforme de feedback collaboratif."

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "FOROM",
    template: "%s | FOROM",
  },
  description,
  applicationName: "FOROM",
  keywords: [
    "feedback",
    "product feedback",
    "propositions",
    "community",
    "ideas",
    "civic tech",
  ],
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "FOROM",
    title: "FOROM",
    description,
    images: [
      {
        url: "/icon.png",
        width: 512,
        height: 512,
        alt: "FOROM",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "FOROM",
    description,
    images: ["/icon.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const headersList = await headers()
  const locale = headersList.get("x-next-intl-locale") ?? "fr"

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}