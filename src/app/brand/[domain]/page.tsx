import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { fmtDateTime } from "@/lib/brands";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

async function load(raw: string) {
  const domain = decodeURIComponent(raw).toLowerCase();
  const reports = await db.listReportsForDomain(domain, 50).catch(() => []);
  return { domain, reports };
}

export async function generateMetadata({ params }: { params: Promise<{ domain: string }> }): Promise<Metadata> {
  const { domain, reports } = await load((await params).domain);
  if (!reports.length) return { title: "Brand not found" };
  const brand = reports[0].brand;
  return {
    title: `Did AI pick ${brand}? All checks`,
    description: `Every public check of how often ChatGPT and Claude recommend ${brand} (${domain}), newest first.`,
    alternates: { canonical: `/brand/${domain}` },
  };
}

export default async function BrandPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain, reports } = await load((await params).domain);
  if (!reports.length) notFound();
  const brand = reports[0].brand;
  return (
    <div className="mx-auto max-w-3xl px-5 py-14">
      <Link href="/" className="text-sm text-muted hover:text-ink">← All brands</Link>
      <div className="mt-6 flex items-center gap-4">
        <BrandLogo domain={domain} name={brand} size={56} />
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl">{brand}</h1>
          <p className="text-muted">{domain}{reports[0].category ? ` · ${reports[0].category}` : ""}</p>
        </div>
      </div>
      <h2 className="mt-10 text-lg font-semibold">{reports.length} check{reports.length > 1 ? "s" : ""}, newest first</h2>
      <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-white">
        {reports.map((r, i) => (
          <li key={r.id}>
            <Link href={`/r/${r.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-accent-soft/40">
              <span>
                {fmtDateTime(r.created_at)}
                {i === 0 && <span className="ml-2 rounded-full bg-accent-soft text-accent text-xs px-2 py-0.5">Latest</span>}
              </span>
              <span className="flex items-center gap-4">
                {r.pickRate != null && <span className="tabular font-semibold">{Math.round(r.pickRate * 100)}% picked</span>}
                <span className="text-accent text-sm">Open →</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted">Each check is a separate run; numbers can move between runs because AI answers change.</p>
    </div>
  );
}
