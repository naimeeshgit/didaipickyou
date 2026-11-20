import Link from "next/link";
import { BrandLogo } from "./BrandLogo";
import { fmtDate, type BrandGroup } from "@/lib/brands";

export function BrandCard({ g }: { g: BrandGroup }) {
  const pick = g.latest.pickRate;
  const n = g.reports.length;
  return (
    <div className="group relative rounded-2xl border border-line bg-white p-5 hover:border-accent hover:shadow-[0_4px_24px_-12px_rgba(61,75,255,0.35)] transition">
      <Link href={`/r/${g.latest.id}`} className="absolute inset-0 rounded-2xl" aria-label={`Latest check for ${g.brand}`} />
      <div className="flex items-start gap-3">
        <BrandLogo domain={g.domain} name={g.brand} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{g.brand}</p>
          <p className="text-xs text-muted truncate">{g.domain}</p>
        </div>
        {pick != null && (
          <div className="text-right">
            <p className="text-2xl font-semibold tabular leading-none">{Math.round(pick * 100)}%</p>
            <p className="text-[11px] text-muted mt-1">picked by AI</p>
          </div>
        )}
      </div>
      {g.category && <p className="mt-3 text-sm text-muted line-clamp-1">{g.category}</p>}
      <div className="mt-4 flex items-center justify-between text-xs text-muted">
        <span>
          {n} check{n > 1 ? "s" : ""} · latest {fmtDate(g.latest.created_at)}
        </span>
        {n > 1 && g.domain ? (
          <Link href={`/brand/${encodeURIComponent(g.domain)}`} className="relative z-10 text-accent hover:underline">
            All checks →
          </Link>
        ) : (
          <span className="text-accent opacity-0 group-hover:opacity-100 transition">Open →</span>
        )}
      </div>
    </div>
  );
}
