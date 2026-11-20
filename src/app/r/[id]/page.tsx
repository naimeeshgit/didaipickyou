import { toolNames } from "@/lib/config";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/Report";
import { ReportActions } from "@/components/ReportActions";
import { db } from "@/lib/db";
import { loadReport } from "@/lib/reports";

const load = loadReport;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const r = await load(id);
  if (!r) return { title: "Report not found" };
  const pick = r.scores.find((s) => s.isTarget)?.pickRate ?? 0;
  const title = r.sample ? "Sample AI visibility report" : `Did AI pick ${r.brand.name}? AI visibility report`;
  return {
    title,
    description: `${toolNames(r.byTool.map((t) => t.tool))} brought up ${r.brand.name} unprompted in ${Math.round(pick * 100)}% of answers to buyer questions about ${r.category}. See who AI recommends instead, the sources it cites and what to fix.`,
    robots: r.sample ? { index: false } : undefined,
    alternates: { canonical: `/r/${id}` },
  };
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await load(id);
  if (!report) notFound();
  const others = report.sample || !report.domain ? [] : await db.listReportsForDomain(report.domain, 50).catch(() => []);
  return (
    <>
      <div className="mx-auto max-w-6xl px-5 pt-8 no-print flex flex-wrap items-center justify-between gap-3">
        {others.length > 1 ? (
          <Link href={`/brand/${encodeURIComponent(report.domain)}`} className="text-sm text-muted hover:text-ink">
            ← All {others.length} checks for {report.brand.name}
          </Link>
        ) : (
          <Link href="/" className="text-sm text-muted hover:text-ink">← All brands</Link>
        )}
        <ReportActions id={id} brand={report.brand.name} />
      </div>
      <ReportView report={report} />
      <div className="mx-auto max-w-6xl px-5 no-print">
        <div className="rounded-2xl border border-line bg-accent-soft p-6 flex flex-wrap items-center justify-between gap-4">
          <p className="font-semibold">Does AI pick your brand? Run the same check free.</p>
          <Link href="/scan" className="rounded-full bg-ink text-paper px-5 py-2 text-sm hover:bg-accent">Check my brand</Link>
        </div>
      </div>
    </>
  );
}
