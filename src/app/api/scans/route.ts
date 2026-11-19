import { NextResponse } from "next/server";
import { jobsFor, startScan, startSchema } from "@/lib/scan";
import { checkScanQuota } from "@/lib/limits";

export async function POST(req: Request) {
  const parsed = startSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Some questions or brand names are missing or too long." }, { status: 400 });
  }
  const quota = await checkScanQuota();
  if (!quota.ok) return NextResponse.json({ error: quota.reason }, { status: 429 });
  try {
    const scan = await startScan(parsed.data);
    await quota.consume();
    return NextResponse.json({ scanId: scan.id, jobs: jobsFor(scan), sample: scan.sample });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't start the scan." }, { status: 400 });
  }
}
