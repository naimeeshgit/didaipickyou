import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const reports = await db.listPublicReports(500).catch(() => []);
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/scan`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/how-it-works`, changeFrequency: "monthly", priority: 0.6 },
    ...reports.map((r) => ({ url: `${base}/r/${r.id}`, lastModified: new Date(r.created_at), changeFrequency: "weekly" as const, priority: 0.7 })),
    ...[...new Set(reports.map((r) => r.domain).filter(Boolean))].map((d) => ({ url: `${base}/brand/${d}`, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
