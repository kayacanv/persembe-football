import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"
import { Inter } from "next/font/google"
import { cookies } from "next/headers"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { ServiceWorkerRegistration } from "@/app/components/service-worker-registration"
import { LanguageProvider } from "@/lib/i18n/LanguageProvider"
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n/config"

const inter = Inter({ subsets: ["latin", "latin-ext"] })

export const metadata: Metadata = {
  title: "Perşembe Halısaha",
  description: "Perşembe günü halı saha maçı organizasyonu",
  applicationName: "Perşembe Halısaha",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
  // Home-screen app on iPhone: title under the icon, normal status bar.
  appleWebApp: {
    capable: true,
    title: "Perşembe",
    statusBarStyle: "default",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Match the page background so the installed app's status bar blends in.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value
  const locale: Locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <LanguageProvider initialLocale={locale}>{children}</LanguageProvider>
        </ThemeProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}
