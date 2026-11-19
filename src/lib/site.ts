import { lookup } from "dns/promises";
import { isIP } from "net";
import { db, hash } from "./db";

export function normaliseUrl(input: string) {
  let s = input.trim();
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  const u = new URL(s);
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("Only http and https websites are supported.");
  return u;
}

export const domainOf = (u: URL) => u.hostname.replace(/^www\./, "").toLowerCase();

function isPrivateAddress(ip: string) {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    return v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v === "::";
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 || a === 127 || a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

/** Refuses internal or private addresses so the site reader can't be pointed at our own infrastructure. */
async function assertPublicHost(host: string) {
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) throw new Error("That address isn't a public website.");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addresses.some((a) => isPrivateAddress(a.address))) throw new Error("That address isn't a public website.");
}

function htmlToText(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const description =
    html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1] ??
    html.match(/<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']*)["']/i)?.[1] ??
    "";
  const body = html
    .replace(/<(script|style|noscript|svg|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { title: title.trim(), description: description.trim(), text: body };
}

export interface SiteSnapshot {
  url: string;
  title: string;
  description: string;
  text: string;
}

/** The site exists but would not give us its page (bot protection, timeout, JS-only page). */
export class SiteUnreadable extends Error {}

const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
};

/** Reads a website's home page. Cached for 24 hours. */
export async function readSite(input: string): Promise<SiteSnapshot> {
  let url = normaliseUrl(input);
  const key = `site:${hash(url.toString())}`;
  const cached = await db.cacheGet<SiteSnapshot>(key);
  if (cached) return cached;

  let res: Response | null = null;
  for (let hop = 0; hop < 4; hop++) {
    await assertPublicHost(url.hostname);
    try {
      res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10_000), headers: BROWSER_HEADERS });
    } catch {
      throw new SiteUnreadable("The website didn't respond.");
    }
    const next = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && next) {
      url = new URL(next, url);
      continue;
    }
    break;
  }
  if (!res || !res.ok) throw new SiteUnreadable(`The website blocked our reader (status ${res?.status ?? "unknown"}).`);

  const raw = (await res.text()).slice(0, 1_500_000);
  const { title, description, text } = htmlToText(raw);
  if (text.length < 300) throw new SiteUnreadable("The page has almost no readable text.");
  const snapshot = { url: url.toString(), title, description, text: text.slice(0, 8000) };
  await db.cacheSet(key, snapshot, 24 * 3600);
  return snapshot;
}
