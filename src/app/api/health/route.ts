import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { activeTools, config, hasKeys, TOOLS, type ToolId } from "@/lib/config";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Check = { ok: boolean; model: string; keySet: boolean; ms?: number; reply?: string; error?: string };

const modelFor = (tool: ToolId) => {
  const id = config.answerModels[tool];
  if (tool === "chatgpt") return openai(id);
  if (tool === "claude") return anthropic(id);
  return google(id);
};

async function check(tool: ToolId, withSearch: boolean): Promise<Check> {
  const model = config.answerModels[tool];
  if (!hasKeys[tool]) return { ok: false, model, keySet: false, error: "API key not set in Vercel" };
  const started = Date.now();
  try {
    const r = await generateText({
      model: modelFor(tool),
      prompt: withSearch ? "Search the web and tell me today's date in one short line." : "Reply with the single word OK.",
      maxOutputTokens: withSearch ? 200 : 20,
      maxRetries: 0,
      tools: withSearch && tool === "gemini" ? { google_search: google.tools.googleSearch({}) } : undefined,
    });
    return { ok: true, model, keySet: true, ms: Date.now() - started, reply: r.text.slice(0, 120) };
  } catch (e) {
    const err = e as { message?: string; statusCode?: number; responseBody?: string };
    const detail = err.responseBody ? ` ${err.responseBody.slice(0, 300)}` : "";
    return { ok: false, model, keySet: true, ms: Date.now() - started, error: `${err.statusCode ?? ""} ${err.message ?? "failed"}${detail}`.trim() };
  }
}

/**
 * Checks each assistant's API with a tiny request. Results are cached for 10 minutes,
 * so opening this page repeatedly costs nothing extra.
 * /api/health            → plain check for ChatGPT, Claude and Gemini
 * /api/health?search=1   → also checks Gemini with Google Search on (what scans use)
 */
export async function GET(req: Request) {
  const withSearch = new URL(req.url).searchParams.get("search") === "1";
  const key = `health:${withSearch ? "search" : "plain"}`;
  const cached = await db.cacheGet<unknown>(key).catch(() => null);
  if (cached) return Response.json({ cached: true, ...(cached as object) });

  const results: Record<string, Check> = {};
  await Promise.all(TOOLS.map(async (t) => (results[t.id] = await check(t.id, false))));
  if (withSearch) results["gemini_with_search"] = await check("gemini", true);

  const body = { checkedAt: new Date().toISOString(), usedInScans: activeTools, results };
  await db.cacheSet(key, body, 600).catch(() => {});
  return Response.json(body);
}
