import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/Report";
import { db } from "@/lib/db";
import { buildSampleReport } from "@/lib/scan";
import type { Report } from "@/lib/types";

async function load(id: string): Promise<Report | null> {
  if (id === "sample") return buildSampleReport();
  if (!/^[\w-]{4,40}$/.test(id)) return null;
  return db.getDoc<Report>("reports", id);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const r = await load(id);
  if (!r) return { title: "Report not found" };
  const pick = r.scores.find((s) => s.isTarget)?.pickRate ?? 0;
  const title = r.sample ? "Sample AI visibility report" : `Did AI pick ${r.brand.name}? AI visibility report`;
  return {
    title,
    description: `ChatGPT, Claude and Gemini named ${r.brand.name} in ${Math.round(pick * 100)}% of answers to buyer questions about ${r.category}. See who AI recommends instead, the sources it cites and what to fix.`,
    robots: r.sample ? { index: false } : undefined,
    alternates: { canonical: `/r/${id}` },
  };
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await load(id);
  if (!report) notFound();
  return (
    <>
      <ReportView report={report} />
      <div className="mx-auto max-w-6xl px-5">
        <div className="rounded-2xl border border-line bg-accent-soft p-6 flex flex-wrap items-center justify-between gap-4">
          <p className="font-semibold">Does AI pick your brand? Run the same check free.</p>
          <Link href="/scan" className="rounded-full bg-ink text-paper px-5 py-2 text-sm hover:bg-accent">Check my brand</Link>
        </div>
      </div>
    </>
  );
}
