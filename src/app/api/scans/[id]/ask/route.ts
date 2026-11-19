import { NextResponse } from "next/server";
import { z } from "zod";
import { runJob } from "@/lib/scan";

export const maxDuration = 120;

const schema = z.object({
  q: z.number().int().min(0).max(40),
  tool: z.enum(["chatgpt", "claude", "gemini"]),
  run: z.number().int().min(0).max(3),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  try {
    const r = await runJob(id, parsed.data.q, parsed.data.tool, parsed.data.run);
    return NextResponse.json({
      q: r.q, tool: r.tool, run: r.run, error: r.error ?? null,
      hits: r.hits, cached: r.cached ?? false,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed." }, { status: 400 });
  }
}
