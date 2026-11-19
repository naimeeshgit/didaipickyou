// Central configuration. Every value can be overridden with an environment variable.

export type ToolId = "chatgpt" | "claude" | "gemini";

export const TOOLS: { id: ToolId; label: string }[] = [
  { id: "chatgpt", label: "ChatGPT" },
  { id: "claude", label: "Claude" },
  { id: "gemini", label: "Gemini" },
];

const env = (key: string, fallback: string) => process.env[key]?.trim() || fallback;
const num = (key: string, fallback: number) => {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

export const config = {
  // Models that answer the buyer questions. Set each to the model the
  // consumer app serves by default, so the scan measures what buyers see.
  answerModels: {
    chatgpt: env("OPENAI_ANSWER_MODEL", "gpt-5.4-mini"),
    claude: env("ANTHROPIC_ANSWER_MODEL", "claude-haiku-5-5"),
    gemini: env("GOOGLE_ANSWER_MODEL", "gemini-4-argon"),
  } as Record<ToolId, string>,
  // Strong model: reads the website, designs questions, writes the fix list.
  designModel: env("DESIGN_MODEL", "claude-sonnet-5-5"),
  // Cheap model: sentiment and claim checks on each answer.
  analysisModel: env("ANALYSIS_MODEL", "claude-haiku-5-5"),

  // Kept small while testing; set SCAN_QUESTIONS=20 in Vercel for full scans.
  questionsPerScan: Math.min(num("SCAN_QUESTIONS", 2), 30),
  // Each run asks the same question in different words (run 1 = original wording).
  runsPerQuestion: Math.min(num("SCAN_RUNS", 3), 3),
  webSearch: env("ANSWER_WEB_SEARCH", "on") !== "off",

  freeScansPerIpPerDay: num("FREE_SCANS_PER_IP_PER_DAY", 2),
  dailyScanCap: num("DAILY_SCAN_CAP", 30),

  featuredScanId: process.env.FEATURED_SCAN_ID?.trim() || "",
  siteUrl: env("NEXT_PUBLIC_SITE_URL", "http://localhost:3000"),
};

export const hasKeys = {
  chatgpt: Boolean(process.env.OPENAI_API_KEY),
  claude: Boolean(process.env.ANTHROPIC_API_KEY),
  gemini: Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
};

/** Assistants to ask. Default ChatGPT + Claude; add Gemini later with ASSISTANTS=chatgpt,claude,gemini. */
const wanted = env("ASSISTANTS", "chatgpt,claude").split(",").map((x) => x.trim().toLowerCase());
export const activeTools: ToolId[] = TOOLS.map((t) => t.id).filter((id) => wanted.includes(id));

/** Ready for real scans: Anthropic key (question design + analysis) and a key for every active assistant. */
export const scanReady = activeTools.length > 0 && hasKeys.claude && activeTools.every((t) => hasKeys[t]);

/** "ChatGPT and Claude", "ChatGPT, Claude and Gemini" */
export const toolNames = (ids: ToolId[]) => {
  const names = ids.map((id) => TOOLS.find((t) => t.id === id)?.label ?? id);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0] ?? "";
};

/**
 * Sample mode (made-up data) is for local testing only. It never runs on the live site:
 * in production a missing key is an error, not a reason to show fake results.
 */
export const sampleMode =
  process.env.NODE_ENV !== "production" && (process.env.SAMPLE_MODE === "on" || !scanReady);
