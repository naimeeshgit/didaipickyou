import { neon } from "@neondatabase/serverless";
import { createHash, randomBytes } from "crypto";

/**
 * Storage. Uses Postgres (Neon) when DATABASE_URL is set; otherwise an
 * in-memory store, which is fine for local development only.
 */

type Row = Record<string, unknown>;

interface Store {
  getDoc<T>(table: string, id: string): Promise<T | null>;
  putDoc(table: string, id: string, data: unknown, extra?: Row): Promise<void>;
  listPublicReports(limit: number): Promise<{ id: string; brand: string; created_at: string }[]>;
  cacheGet<T>(key: string): Promise<T | null>;
  cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  bumpUsage(day: string, who: string): Promise<{ mine: number; total: number }>;
  peekUsage(day: string, who: string): Promise<{ mine: number; total: number }>;
}

const TABLES = ["designs", "scans", "answers", "reports"] as const;

class MemoryStore implements Store {
  private docs = new Map<string, unknown>();
  private cache = new Map<string, { v: unknown; exp: number }>();
  private usage = new Map<string, number>();
  private publicIndex: { id: string; brand: string; created_at: string }[] = [];

  async getDoc<T>(table: string, id: string) {
    return (this.docs.get(`${table}:${id}`) as T) ?? null;
  }
  async putDoc(table: string, id: string, data: unknown, extra?: Row) {
    this.docs.set(`${table}:${id}`, data);
    if (table === "reports" && extra?.is_public) {
      this.publicIndex = [
        { id, brand: String(extra.brand ?? ""), created_at: new Date().toISOString() },
        ...this.publicIndex.filter((r) => r.id !== id),
      ];
    }
  }
  async listPublicReports(limit: number) {
    return this.publicIndex.slice(0, limit);
  }
  async cacheGet<T>(key: string) {
    const hit = this.cache.get(key);
    if (!hit || hit.exp < Date.now()) return null;
    return hit.v as T;
  }
  async cacheSet(key: string, value: unknown, ttlSeconds: number) {
    this.cache.set(key, { v: value, exp: Date.now() + ttlSeconds * 1000 });
  }
  async peekUsage(day: string, who: string) {
    let total = 0;
    for (const [k, v] of this.usage) if (k.startsWith(`${day}:`)) total += v;
    return { mine: this.usage.get(`${day}:${who}`) ?? 0, total };
  }
  async bumpUsage(day: string, who: string) {
    const k = `${day}:${who}`;
    this.usage.set(k, (this.usage.get(k) ?? 0) + 1);
    return this.peekUsage(day, who);
  }
}

class PostgresStore implements Store {
  private sql = neon(process.env.DATABASE_URL!);
  private ready: Promise<void> | null = null;

  private init() {
    if (!this.ready) {
      this.ready = (async () => {
        for (const t of TABLES) {
          await this.sql.query(
            `create table if not exists ${t} (id text primary key, data jsonb not null, brand text, is_public boolean default false, created_at timestamptz default now())`,
          );
        }
        await this.sql.query(
          `create table if not exists cache (key text primary key, value jsonb not null, expires_at timestamptz not null)`,
        );
        await this.sql.query(
          `create table if not exists usage (day text not null, who text not null, count int not null default 0, primary key (day, who))`,
        );
      })();
    }
    return this.ready;
  }

  async getDoc<T>(table: string, id: string) {
    await this.init();
    const rows = (await this.sql.query(`select data from ${table} where id = $1`, [id])) as Row[];
    return (rows[0]?.data as T) ?? null;
  }
  async putDoc(table: string, id: string, data: unknown, extra?: Row) {
    await this.init();
    await this.sql.query(
      `insert into ${table} (id, data, brand, is_public) values ($1, $2, $3, $4)
       on conflict (id) do update set data = excluded.data, brand = excluded.brand, is_public = excluded.is_public`,
      [id, JSON.stringify(data), (extra?.brand as string) ?? null, Boolean(extra?.is_public)],
    );
  }
  async listPublicReports(limit: number) {
    await this.init();
    return (await this.sql.query(
      `select id, brand, created_at from reports where is_public order by created_at desc limit $1`,
      [limit],
    )) as { id: string; brand: string; created_at: string }[];
  }
  async cacheGet<T>(key: string) {
    await this.init();
    const rows = (await this.sql.query(
      `select value from cache where key = $1 and expires_at > now()`,
      [key],
    )) as Row[];
    return (rows[0]?.value as T) ?? null;
  }
  async cacheSet(key: string, value: unknown, ttlSeconds: number) {
    await this.init();
    await this.sql.query(
      `insert into cache (key, value, expires_at) values ($1, $2, now() + ($3 || ' seconds')::interval)
       on conflict (key) do update set value = excluded.value, expires_at = excluded.expires_at`,
      [key, JSON.stringify(value), String(ttlSeconds)],
    );
  }
  async peekUsage(day: string, who: string) {
    await this.init();
    const rows = (await this.sql.query(
      `select coalesce(sum(count),0)::int as total, coalesce(sum(count) filter (where who = $2),0)::int as mine from usage where day = $1`,
      [day, who],
    )) as { total: number; mine: number }[];
    return { mine: rows[0]?.mine ?? 0, total: rows[0]?.total ?? 0 };
  }
  async bumpUsage(day: string, who: string) {
    await this.init();
    await this.sql.query(
      `insert into usage (day, who, count) values ($1, $2, 1) on conflict (day, who) do update set count = usage.count + 1`,
      [day, who],
    );
    return this.peekUsage(day, who);
  }
}

const globalStore = globalThis as unknown as { __didaipickyouStore?: Store };
export const db: Store =
  globalStore.__didaipickyouStore ??
  (globalStore.__didaipickyouStore = process.env.DATABASE_URL ? new PostgresStore() : new MemoryStore());

export const usingDatabase = Boolean(process.env.DATABASE_URL);

export const newId = (bytes = 9) => randomBytes(bytes).toString("base64url");
export const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);

export const today = () => new Date().toISOString().slice(0, 10);

/** ISO year-week, e.g. 2026-W47. Answers are cached within a week only. */
export function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
