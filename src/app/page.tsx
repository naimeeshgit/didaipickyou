import Link from "next/link";
import { BrandCard } from "@/components/BrandCard";
import { UrlForm } from "@/components/UrlForm";
import { groupByBrand } from "@/lib/brands";
import { activeTools, config, sampleMode, toolNames } from "@/lib/config";
import { db } from "@/lib/db";
import type { Report } from "@/lib/types";

export const dynamic = "force-dynamic";

const pct = (x: number) => `${Math.round(x * 100)}%`;

function CaseStudy({ report }: { report: Report }) {
  const target = report.scores.find((s) => s.isTarget)!;
  return (
    <Link href={`/r/${report.scanId}`} className="block rounded-3xl border border-line bg-white p-6 md:p-8 hover:border-accent transition">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-muted">
          Case study · {report.category}
        </p>
        <span className="text-sm text-accent">Read the full report →</span>
      </div>
      <h3 className="mt-2 text-2xl font-semibold">
        AI named {report.brand.name} in {pct(target.pickRate)} of answers
      </h3>
      <div className="mt-6 space-y-2.5">
        {report.scores.map((s) => (
          <div key={s.name} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm">
            <span className={`truncate ${s.isTarget ? "font-semibold text-accent" : ""}`}>{s.name}</span>
            <div className="h-2.5 rounded-full bg-line/70 overflow-hidden">
              <div className={`h-full rounded-full ${s.isTarget ? "bg-accent" : "bg-ink/35"}`} style={{ width: `${Math.max(2, s.pickRate * 100)}%` }} />
            </div>
            <span className="tabular text-right">{pct(s.pickRate)}</span>
          </div>
        ))}
      </div>
    </Link>
  );
}

export default async function Home() {
  const list = await db.listPublicReports(200).catch(() => []);
  const brands = groupByBrand(list);
  const featuredId = config.featuredScanId || list[0]?.id;
  const featured = featuredId ? await db.getDoc<Report>("reports", featuredId) : null;
  const showcase = featured && !featured.sample ? featured : null;

  return (
    <div>
      <section className="mx-auto max-w-6xl px-5 pt-20 pb-14 text-center flex flex-col items-center">
        <p className="rounded-full bg-accent-soft text-accent text-sm px-3 py-1">Free check across {toolNames(activeTools)}</p>
        <h1 className="mt-6 font-[family-name:var(--font-display)] text-5xl md:text-7xl tracking-tight leading-[1.05]">
          Did AI pick you?
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted">
          Buyers now ask AI assistants which product to choose. We ask {toolNames(activeTools)} the questions your buyers ask,
          and show how often they recommend you, who they pick instead, and what to fix.
        </p>
        <div className="mt-8 w-full flex justify-center">
          <UrlForm large />
        </div>
        <p className="mt-3 text-xs text-muted">
          {config.questionsPerScan} buyer questions · {activeTools.length} assistants · {config.runsPerQuestion} wordings each · about 2 minutes
          {sampleMode ? " · local test mode, made-up data" : ""}
        </p>
      </section>

      {brands.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pb-14">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Brands already checked</h2>
              <p className="text-sm text-muted mt-1">Open any report, or check your own brand above.</p>
            </div>
            <span className="text-sm text-muted">{brands.length} brand{brands.length > 1 ? "s" : ""}</span>
          </div>
          <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {brands.slice(0, 9).map((g) => (
              <BrandCard key={g.key} g={g} />
            ))}
          </div>
        </section>
      )}

      {showcase && (
        <section className="mx-auto max-w-6xl px-5">
          <CaseStudy report={showcase} />
        </section>
      )}

      <section className="mx-auto max-w-6xl px-5 mt-16 grid md:grid-cols-3 gap-5">
        {[
          { n: "1", t: "We read your website", d: "An AI model works out your category, your buyers and your real competitors, then writes the questions buyers ask. You can edit them." },
          { n: "2", t: "We ask the assistants", d: `Each question goes to ${toolNames(activeTools)} with web search on, ${config.runsPerQuestion} times in different words, the way different buyers would ask it.` },
          { n: "3", t: "You see who gets picked", d: "Your pick rate against competitors, the questions where you're missing, the sources AI cites, wrong facts about you, and a fix list." },
        ].map((s) => (
          <div key={s.n} className="rounded-2xl border border-line bg-white p-6">
            <span className="inline-grid place-items-center size-8 rounded-full bg-ink text-paper text-sm">{s.n}</span>
            <h3 className="mt-4 font-semibold">{s.t}</h3>
            <p className="mt-2 text-sm text-muted">{s.d}</p>
          </div>
        ))}
      </section>

    </div>
  );
}
