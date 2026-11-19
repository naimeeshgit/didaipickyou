import type { ToolId } from "./config";
import type { AnswerAnalysis, Design, Source } from "./types";

/**
 * Sample mode. Used when API keys are not set, so the whole flow can be tried
 * without cost. Every brand here is fictional and every page that shows this
 * data says so.
 */

export const SAMPLE_DESIGN: Omit<Design, "id" | "url" | "domain"> = {
  sample: true,
  brand: { name: "Quillnote", aliases: ["Quill Note"] },
  category: "AI meeting note-taker",
  oneLiner: "An AI assistant that records meetings and writes the notes and action items.",
  audience: "Sales and customer-success teams at mid-size companies",
  competitors: [
    { name: "Scribewise", aliases: [] },
    { name: "Notara", aliases: [] },
    { name: "Penline", aliases: [] },
    { name: "Ledgerly Notes", aliases: ["Ledgerly"] },
  ],
  facts: [
    "Quillnote integrates with Zoom, Google Meet and Microsoft Teams",
    "Quillnote offers a free plan with 10 meetings a month",
    "Quillnote syncs notes to HubSpot and Salesforce",
  ],
  questions: [
    { type: "category", text: "best AI note taker for sales calls" },
    { type: "category", text: "which AI meeting assistant should a 50 person startup use" },
    { type: "category", text: "top AI tools for taking meeting notes in 2026" },
    { type: "category", text: "AI notetaker that works with Teams and Zoom" },
    { type: "category", text: "most accurate AI meeting transcription tool" },
    { type: "category", text: "AI note taker for customer success teams" },
    { type: "problem", text: "how do I stop my sales reps forgetting follow ups after calls" },
    { type: "problem", text: "my team wastes time writing meeting notes, how to fix" },
    { type: "problem", text: "how to get call notes into our CRM automatically" },
    { type: "problem", text: "how to share meeting summaries with people who missed the call" },
    { type: "problem", text: "how can managers review sales calls faster" },
    { type: "problem", text: "how to track action items from meetings" },
    { type: "comparison", text: "Quillnote vs Scribewise for a sales team" },
    { type: "comparison", text: "alternatives to Notara" },
    { type: "comparison", text: "is Quillnote better than Penline" },
    { type: "comparison", text: "Scribewise alternatives that sync to HubSpot" },
    { type: "comparison", text: "Notara vs Quillnote pricing" },
    { type: "feature", text: "AI note taker with free plan" },
    { type: "feature", text: "meeting notes tool that syncs to Salesforce" },
    { type: "feature", text: "AI notetaker that supports Hindi and English" },
  ],
};

// Small deterministic random generator so a sample scan looks the same every time.
function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SAMPLE_SOURCES: Source[] = [
  { url: "https://www.g2.example/categories/meeting-notes", title: "Best Meeting Note Software", domain: "g2.example" },
  { url: "https://techreviewhub.example/ai-note-takers", title: "AI note takers compared", domain: "techreviewhub.example" },
  { url: "https://www.reddit.example/r/sales/notetakers", title: "Which notetaker do you use?", domain: "reddit.example" },
  { url: "https://scribewise.example/compare", title: "Scribewise vs the rest", domain: "scribewise.example" },
  { url: "https://quillnote.example/features", title: "Quillnote features", domain: "quillnote.example" },
];

const bias: Record<ToolId, number> = { chatgpt: 0.55, claude: 0.4, gemini: 0.3 };

export const sampleVariants = (text: string) => [`what would you suggest: ${text}`, `${text}? need a quick answer`];

export function sampleAnswer(q: number, tool: ToolId, run: number, question: string) {
  const r = rng(`${q}:${tool}:${run}`);
  const type = SAMPLE_DESIGN.questions[q]?.type ?? "category";
  const pool = ["Scribewise", "Notara", "Penline", "Ledgerly Notes"];
  const picks = pool.filter(() => r() < 0.55);
  if (!picks.length) picks.push(pool[Math.floor(r() * pool.length)]);
  const mentionTarget = type === "comparison" ? r() < 0.9 : r() < bias[tool] - (type === "problem" ? 0.15 : 0);
  if (mentionTarget) picks.splice(Math.floor(r() * (picks.length + 1)), 0, "Quillnote");

  const lines = picks.map((p, i) => `${i + 1}. **${p}**: ${["strong CRM sync", "good free plan", "accurate transcripts", "popular with sales teams", "simple to set up"][Math.floor(r() * 5)]}.`);
  const text = `Sample answer (made-up data) to: "${question}"\n\nHere are some options worth looking at:\n${lines.join("\n")}\n\nPick based on which tools your team already uses.`;
  const sources = SAMPLE_SOURCES.filter(() => r() < 0.45);

  const analysis: AnswerAnalysis = mentionTarget
    ? {
        targetSentiment: r() < 0.7 ? "positive" : "neutral",
        targetRecommended: r() < 0.75,
        topPick: picks[0],
        claims:
          r() < 0.15
            ? [{ claim: "Quillnote has no free plan", verdict: "contradicted" }]
            : [{ claim: "Quillnote syncs with HubSpot", verdict: "supported" }],
      }
    : { targetSentiment: "not_mentioned", targetRecommended: false, topPick: picks[0], claims: [] };

  return { text, sources, analysis };
}
