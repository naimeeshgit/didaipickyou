import { headers } from "next/headers";
import { config } from "./config";
import { db, hash, today } from "./db";

export async function visitorId() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  // Store only a hash of the IP address.
  return hash(`${ip}:${process.env.IP_SALT ?? "didaipickyou"}`);
}

/** Checks the free-scan limits. Call `consume` only when a scan actually starts. */
export async function checkScanQuota() {
  const who = await visitorId();
  const day = today();
  const usage = await db.peekUsage(day, who);
  if (usage.total >= config.dailyScanCap) {
    return { ok: false as const, reason: "Today's free scans are used up. Please try again tomorrow." };
  }
  if (usage.mine >= config.freeScansPerIpPerDay) {
    return {
      ok: false as const,
      reason: `You've used your ${config.freeScansPerIpPerDay} free scans for today. Please come back tomorrow.`,
    };
  }
  return { ok: true as const, consume: () => db.bumpUsage(day, who) };
}
