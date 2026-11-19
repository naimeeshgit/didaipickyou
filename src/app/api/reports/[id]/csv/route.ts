import { TOOLS } from "@/lib/config";
import { loadReport } from "@/lib/reports";

const cell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await loadReport(id);
  if (!r) return new Response("Report not found", { status: 404 });

  const label = (t: string) => TOOLS.find((x) => x.id === t)?.label ?? t;
  const rows: unknown[][] = [
    ["question", "type", "assistant", "wording", "asked_as", "model", `named_${r.brand.name}`, "position", "brands_named", "sentiment", "sources", "error", "answer"],
  ];
  for (const a of r.answers) {
    const q = r.questions[a.q];
    const mine = a.hits.find((h) => h.name === r.brand.name);
    rows.push([
      q?.text, q?.type, label(a.tool), a.run + 1, a.asked ?? q?.text, a.model,
      a.error ? "" : mine ? "yes" : "no", mine?.position ?? "",
      a.hits.map((h) => h.name).join("; "), a.analysis.targetSentiment,
      a.sources.map((s) => s.url).join(" "), a.error ?? "", a.text,
    ]);
  }
  const csv = "﻿" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
  const file = `did-ai-pick-${r.brand.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${r.createdAt.slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${file}"` },
  });
}
