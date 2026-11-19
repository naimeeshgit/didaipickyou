import { NextResponse } from "next/server";
import { finishScan } from "@/lib/scan";

export const maxDuration = 120;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const report = await finishScan(id);
    return NextResponse.json({ reportId: report.scanId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't build the report." }, { status: 400 });
  }
}
