import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Did AI Pick You? Free AI visibility check", template: "%s · Did AI Pick You?" },
  description:
    "See whether ChatGPT, Claude and Gemini recommend your brand when buyers ask. Free AI visibility report with share of voice, competitor gaps, cited sources and fixes.",
  openGraph: { type: "website", siteName: "Did AI Pick You?" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-line bg-paper/90 backdrop-blur sticky top-0 z-20">
          <div className="mx-auto max-w-6xl px-5 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="inline-grid place-items-center size-7 rounded-lg bg-ink text-paper text-sm">?</span>
              <span className="whitespace-nowrap">Did AI Pick You?</span>
            </Link>
            <nav className="flex items-center gap-5 text-sm text-muted">
              <Link href="/how-it-works" className="hover:text-ink hidden sm:inline">How it works</Link>
              <Link href="/scan" className="rounded-full bg-ink text-paper px-4 py-1.5 hover:bg-accent">Check my brand</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line mt-20">
          <div className="mx-auto max-w-6xl px-5 py-8 text-sm text-muted flex flex-wrap gap-4 justify-between">
            <span>Did AI Pick You? · Free AI visibility checks</span>
            <span>Answers come from the ChatGPT, Claude and Gemini APIs and can differ from the consumer apps.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
