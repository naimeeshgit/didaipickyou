import { NextResponse } from "next/server";
import { z } from "zod";
import { createDesign } from "@/lib/scan";
import { checkScanQuota } from "@/lib/limits";

export const maxDuration = 120;

const schema = z.object({
  url: z.string().trim().min(3).max(300),
  brand: z.string().trim().max(60).optional(),
  competitors: z.array(z.string().trim().min(1).max(60)).max(6).optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please enter a website address." }, { status: 400 });
  const quota = await checkScanQuota();
  if (!quota.ok) return NextResponse.json({ error: quota.reason }, { status: 429 });
  try {
    return NextResponse.json(await createDesign(parsed.data));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't read that website." }, { status: 400 });
  }
}
