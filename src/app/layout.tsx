import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import "./globals.css";
import { I18nProvider, type Locale } from "@/lib/i18n/provider";
import { VERSION } from "@/lib/i18n/dictionary";
import { SessionProvider } from "@/components/SessionProvider";

export const metadata: Metadata = {
  title: "صَرفي · Sarfi — مدير المصاريف بالصوت",
  description:
    "تطبيق إدارة المصاريف بالصوت بالعامية السورية، محسوب بالليرة السورية الجديدة. Voice-first expense tracker for Syria.",
  applicationName: "Sarfi",
  authors: [{ name: "Abu Omar" }],
  creator: "Abu Omar",
  icons: {
    icon: [{ url: "/app-icon.png", type: "image/png", sizes: "1024x1024" }],
    apple: [{ url: "/app-icon.png", sizes: "1024x1024" }],
  },
  openGraph: {
    title: "صَرفي · Sarfi",
    description: "مدير المصاريف الصوتي — بالليرة السورية الجديدة",
    images: ["/app-icon.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#07100d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const store = await cookies();
  const raw = store.get("locale")?.value;
  const locale: Locale = raw === "en" ? "en" : "ar";

  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Manrope:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="min-h-dvh bg-canvas text-ink antialiased">
        <I18nProvider initialLocale={locale}>
          <SessionProvider>
            {children}
            <span className="sr-only" data-version={VERSION} />
          </SessionProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
