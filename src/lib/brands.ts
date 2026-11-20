import type { PublicReport } from "./db";

/** All public checks for one company, newest first. */
export type BrandGroup = {
  key: string;
  brand: string;
  domain: string;
  category: string;
  latest: PublicReport;
  reports: PublicReport[];
};

const keyOf = (r: PublicReport) => (r.domain || r.brand).toLowerCase().replace(/^www\./, "").trim();

/** Collapse repeat checks of the same company into one entry, keeping the newest first. */
export function groupByBrand(list: PublicReport[]): BrandGroup[] {
  const groups = new Map<string, BrandGroup>();
  for (const r of list) {
    const key = keyOf(r);
    if (!key) continue;
    const g = groups.get(key);
    if (g) g.reports.push(r);
    else groups.set(key, { key, brand: r.brand, domain: r.domain, category: r.category, latest: r, reports: [r] });
  }
  return [...groups.values()];
}

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
