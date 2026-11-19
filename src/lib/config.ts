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
    chatgpt: env("OPENAI_ANSWER_MODEL", "gpt-6-astra"),
    claude: env("ANTHROPIC_ANSWER_MODEL", "claude-sonnet-5-5"),
    gemini: env("GOOGLE_ANSWER_MODEL", "gemini-4-argon"),
  } as Record<ToolId, string>,
  // Strong model: reads the website, designs questions, writes the fix list.
  designModel: env("DESIGN_MODEL", "claude-opus-5-5"),
  // Cheap model: sentiment and claim checks on each answer.
  analysisModel: env("ANALYSIS_MODEL", "claude-haiku-5-5"),

  questionsPerScan: Math.min(num("SCAN_QUESTIONS", 20), 30),
  runsPerQuestion: Math.min(num("SCAN_RUNS", 2), 3),
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

/** Sample mode: no API keys set. Everything runs on labelled, made-up data. */
export const sampleMode =
  process.env.SAMPLE_MODE === "on" ||
  !(hasKeys.chatgpt && hasKeys.claude && hasKeys.gemini);
