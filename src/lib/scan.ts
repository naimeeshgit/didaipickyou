import { z } from "zod";
import { analyseAnswer, askAssistant, designScan, researchSite, rewordQuestions, writeFixes } from "./ai";
import { activeTools, config, sampleMode, scanReady, TOOLS, type ToolId } from "./config";
import { db, hash, isoWeek, newId } from "./db";
import { newMeter } from "./cost";
import { detectBrands } from "./detect";
import { SAMPLE_DESIGN, sampleAnswer, sampleVariants } from "./sample";
import { scoreScan, summaryForFixes } from "./score";
import { domainOf, normaliseUrl, readSite, SiteUnreadable } from "./site";
import type { AnswerRecord, Brand, Design, Fix, Question, Report } from "./types";

export interface Scan {
  id: string;
  createdAt: string;
  sample: boolean;
  url: string;
  domain: string;
  brand: Brand;
  competitors: Brand[];
  category: string;
  oneLiner: string;
  facts: string[];
  questions: Question[];
  runs: number;
  /** AI cost of design + rewording (USD). */
  setupCost?: number;
  /** Assistants asked in this scan. Older scans without it asked every tool. */
  tools?: ToolId[];
  models: Partial<Record<ToolId, string>>;
}

const scanTools = (scan: Scan): ToolId[] => scan.tools ?? TOOLS.map((t) => t.id);

/* ---------- Step 1: design ---------- */

export async function createDesign(input: { url: string; brand?: string; competitors?: string[] }): Promise<Design> {
  const url = normaliseUrl(input.url);
  const id = newId();
  if (!sampleMode && !scanReady) throw new Error("Scanning isn't switched on yet. Please try again later.");
  if (sampleMode) {
    const design: Design = { id, url: url.toString(), domain: domainOf(url), ...SAMPLE_DESIGN };
    await db.putDoc("designs", id, design);
    return design;
  }
  const cacheKey = `design:${hash(`${domainOf(url)}|${input.brand ?? ""}|${(input.competitors ?? []).join(",")}|${config.questionsPerScan}`)}`;
  const cached = await db.cacheGet<Omit<Design, "id">>(cacheKey);
  const meter = newMeter();
  let body = cached;
  if (!body) {
    // Some sites block automated readers (e.g. bot protection). Fall back to learning about them from web search.
    const site = await readSite(url.toString()).catch((e) => {
      if (e instanceof SiteUnreadable) return researchSite(url.toString(), input.brand, meter);
      throw e;
    });
    body = { url: url.toString(), domain: domainOf(url), ...(await designScan(site, input, meter)) };
  }
  if (!cached) await db.cacheSet(cacheKey, body, 7 * 24 * 3600);
  const design: Design = { id, ...body, cost: cached ? 0 : meter.usd };
  await db.putDoc("designs", id, design);
  return design;
}

/* ---------- Step 2: start a scan from an edited design ---------- */

const brandSchema = z.object({
  name: z.string().trim().min(1).max(60),
  aliases: z.array(z.string().trim().min(1).max(60)).max(4).default([]),
});

export const startSchema = z.object({
  designId: z.string().min(4).max(40),
  brand: brandSchema,
  competitors: z.array(brandSchema).min(1).max(6),
  questions: z
    .array(z.object({ text: z.string().trim().min(5).max(220), type: z.enum(["category", "problem", "comparison", "feature"]) }))
    .min(1)
    .max(config.questionsPerScan),
});

export async function startScan(input: z.infer<typeof startSchema>): Promise<Scan> {
  const design = await db.getDoc<Design>("designs", input.designId);
  if (!design) throw new Error("That scan setup has expired. Please start again.");
  const runs = config.runsPerQuestion;
  const texts = input.questions.map((q) => q.text);
  let variants: string[][];
  const setupMeter = newMeter();
  if (design.sample) variants = texts.map(sampleVariants);
  else {
    // Reworded questions are cached, so re-running the same scan reuses the same wordings (and cached answers).
    const vKey = `vars:${hash(`${texts.join("|")}|${runs}`)}`;
    variants = (await db.cacheGet<string[][]>(vKey)) ?? [];
    if (variants.length !== texts.length) {
      variants = await rewordQuestions(texts, runs - 1, setupMeter).catch(() => texts.map(() => []));
      await db.cacheSet(vKey, variants, 7 * 24 * 3600);
    }
  }
  const tools = activeTools;
  const scan: Scan = {
    id: newId(),
    createdAt: new Date().toISOString(),
    sample: Boolean(design.sample),
    url: design.url,
    domain: design.domain,
    brand: input.brand,
    competitors: input.competitors,
    category: design.category,
    oneLiner: design.oneLiner,
    facts: design.facts,
    questions: input.questions.map((q, i) => ({ ...q, variants: variants[i] ?? [] })),
    runs,
    tools,
    setupCost: (design.cost ?? 0) + setupMeter.usd,
    models: Object.fromEntries(tools.map((t) => [t, design.sample ? "sample" : config.answerModels[t]])),
  };
  await db.putDoc("scans", scan.id, scan, { brand: scan.brand.name });
  return scan;
}

export const jobsFor = (scan: Scan) =>
  scan.questions.flatMap((_, q) => scanTools(scan).flatMap((tool) => Array.from({ length: scan.runs }, (_, run) => ({ q, tool, run }))));

/** Run 1 asks the original wording; later runs ask the reworded versions. */
export const wordingFor = (question: Question, run: number) => (run === 0 ? question.text : question.variants?.[run - 1] ?? question.text);

/* ---------- Step 3: one question, one assistant, one run ---------- */

export async function runJob(scanId: string, q: number, tool: ToolId, run: number): Promise<AnswerRecord> {
  const scan = await db.getDoc<Scan>("scans", scanId);
  if (!scan) throw new Error("Scan not found.");
  if (!scan.questions[q] || run < 0 || run >= scan.runs || !scanTools(scan).includes(tool)) {
    throw new Error("That question isn't part of this scan.");
  }
  const answerId = `${scanId}:${q}:${tool}:${run}`;
  const existing = await db.getDoc<AnswerRecord>("answers", answerId);
  if (existing) return existing;

  const question = wordingFor(scan.questions[q], run);
  const brands = [scan.brand, ...scan.competitors];
  let record: AnswerRecord;

  try {
    if (scan.sample) {
      const s = sampleAnswer(q, tool, run, question);
      record = { q, tool, run, asked: question, model: "sample", text: s.text, sources: s.sources, hits: detectBrands(s.text, brands), analysis: s.analysis };
    } else {
      // Answers are cached for the current week only, so each weekly scan gets fresh answers.
      const key = `ans:${hash(`${tool}|${scan.models[tool]}|${question}|${run}|${isoWeek()}`)}`;
      let answer = await db.cacheGet<{ text: string; sources: AnswerRecord["sources"]; model: string; cost?: number }>(key);
      const cached = Boolean(answer);
      if (!answer) {
        answer = await askAssistant(tool, question);
        await db.cacheSet(key, answer, 7 * 24 * 3600);
      }
      const hits = detectBrands(answer.text, brands);
      const aKey = `ana:${hash(`${answer.text}|${scan.brand.name}|${brands.map((b) => b.name).join(",")}`)}`;
      const anaMeter = newMeter();
      let analysis = await db.cacheGet<AnswerRecord["analysis"]>(aKey);
      if (!analysis) {
        analysis = hits.some((h) => h.name === scan.brand.name)
          ? await analyseAnswer(answer.text, scan.brand, brands, scan.facts, anaMeter)
          : { targetSentiment: "not_mentioned", targetRecommended: false, topPick: hits[0]?.name ?? null, claims: [] };
        await db.cacheSet(aKey, analysis, 30 * 24 * 3600);
      }
      record = { q, tool, run, asked: question, cost: (cached ? 0 : answer.cost ?? 0) + anaMeter.usd, model: answer.model, text: answer.text, sources: answer.sources, hits, analysis, cached };
    }
  } catch (e) {
    console.error(`[ask] ${tool} q${q} run${run} failed:`, e);
    record = {
      q, tool, run, asked: question, model: scan.models[tool] ?? "", text: "", sources: [], hits: [],
      analysis: { targetSentiment: "not_mentioned", targetRecommended: false, topPick: null, claims: [] },
      error: e instanceof Error ? e.message.slice(0, 200) : "Request failed",
    };
    return record; // not stored, so a retry can try again
  }
  await db.putDoc("answers", answerId, record);
  return record;
}

/* ---------- Step 4: score, write fixes, publish the report ---------- */

export function sampleFixes(r: Omit<Report, "fixes">): Fix[] {
  const lead = r.scores.find((s) => !s.isTarget);
  const weakTool = [...r.byTool].sort((a, b) => a.pickRate - b.pickRate)[0];
  const weakType = [...r.byType].sort((a, b) => a.pickRate - b.pickRate)[0];
  const brandKeys = [r.brand, ...r.competitors].map((b) => b.name.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const src =
    r.topSources.find((s) => s.domain !== r.domain && !brandKeys.some((k) => k && s.domain.replace(/[^a-z0-9]/g, "").includes(k))) ??
    r.topSources[0];
  const toolName = (t?: string) => TOOLS.find((x) => x.id === t)?.label ?? "the weakest assistant";
  return [
    {
      title: `Publish a comparison page against ${lead?.name}`,
      evidence: `${lead?.name} is named in ${Math.round((lead?.pickRate ?? 0) * 100)}% of answers, ahead of ${r.brand.name}.`,
      action: `Write an honest ${r.brand.name} vs ${lead?.name} page with a feature table and pricing, and link it from the home page.`,
      impact: "high",
    },
    {
      title: `Answer the "${weakType?.type}" questions directly`,
      evidence: `${r.brand.name} appears in only ${Math.round((weakType?.pickRate ?? 0) * 100)}% of ${weakType?.type} answers.`,
      action: "Publish guides that answer these exact questions in plain words, with your product as one of the solutions.",
      impact: "high",
    },
    {
      title: `Get listed on ${src?.domain}`,
      evidence: `${src?.domain} is the most cited source (${src?.count} answers).`,
      action: "Make sure your listing there is complete and current, and ask happy customers to review you.",
      impact: "medium",
    },
    {
      title: `Close the gap on ${toolName(weakTool?.tool)}`,
      evidence: `Pick rate on ${toolName(weakTool?.tool)} is ${Math.round((weakTool?.pickRate ?? 0) * 100)}%.`,
      action: "Check which sources that assistant cites for your category and get coverage there.",
      impact: "medium",
    },
  ];
}

export async function finishScan(scanId: string): Promise<Report> {
  const done = await db.getDoc<Report>("reports", scanId);
  if (done) return done;
  const scan = await db.getDoc<Scan>("scans", scanId);
  if (!scan) throw new Error("Scan not found.");

  const answers: AnswerRecord[] = [];
  for (const j of jobsFor(scan)) {
    const a = await db.getDoc<AnswerRecord>("answers", `${scanId}:${j.q}:${j.tool}:${j.run}`);
    if (a) answers.push(a);
  }
  if (answers.length < jobsFor(scan).length * 0.5) throw new Error("Too many answers are still missing to build a fair report.");

  const scored = scoreScan({
    scanId,
    createdAt: scan.createdAt,
    sample: scan.sample,
    url: scan.url,
    domain: scan.domain,
    brand: scan.brand,
    category: scan.category,
    oneLiner: scan.oneLiner,
    competitors: scan.competitors,
    questions: scan.questions,
    models: scan.models,
    runs: scan.runs,
    answers,
  });
  // Count the jobs that never produced an answer as failed.
  scored.failedAnswers += jobsFor(scan).length - answers.length;
  scored.totalAnswers = jobsFor(scan).length;

  const fixMeter = newMeter();
  let fixes: Fix[];
  try {
    fixes = scan.sample ? sampleFixes(scored) : await writeFixes(summaryForFixes(scored), scan.brand.name, fixMeter);
  } catch {
    fixes = sampleFixes(scored);
  }
  const answerCost = answers.reduce((t, a) => t + (a.cost ?? 0), 0);
  const otherCost = (scan.setupCost ?? 0) + fixMeter.usd;
  const cost = { total: answerCost + otherCost, answers: answerCost, other: otherCost };
  console.log(`[scan ${scanId}] ${scan.brand.name}: estimated AI cost $${cost.total.toFixed(2)} (answers $${answerCost.toFixed(2)}, setup+fixes $${otherCost.toFixed(2)})`);
  const report: Report = { ...scored, fixes, cost };
  await db.putDoc("reports", scanId, report, { brand: scan.brand.name, is_public: !scan.sample });
  return report;
}

/** A fully made-up report, built in memory, for the public sample page. */
export function buildSampleReport(): Report {
  const scan: Scan = {
    id: "sample", createdAt: "2026-11-20T00:00:00.000Z", sample: true,
    url: "https://quillnote.example", domain: "quillnote.example",
    brand: SAMPLE_DESIGN.brand, competitors: SAMPLE_DESIGN.competitors,
    category: SAMPLE_DESIGN.category, oneLiner: SAMPLE_DESIGN.oneLiner, facts: SAMPLE_DESIGN.facts,
    questions: SAMPLE_DESIGN.questions.map((x) => ({ ...x, variants: sampleVariants(x.text) })), runs: 3,
    tools: ["chatgpt", "claude"],
    models: { chatgpt: "sample", claude: "sample" },
  };
  const brands = [scan.brand, ...scan.competitors];
  const answers: AnswerRecord[] = jobsFor(scan).map(({ q, tool, run }) => {
    const asked = wordingFor(scan.questions[q], run);
    const s = sampleAnswer(q, tool, run, asked);
    return { q, tool, run, asked, model: "sample", text: s.text, sources: s.sources, hits: detectBrands(s.text, brands), analysis: s.analysis };
  });
  const scored = scoreScan({
    scanId: "sample", createdAt: scan.createdAt, sample: true, url: scan.url, domain: scan.domain,
    brand: scan.brand, category: scan.category, oneLiner: scan.oneLiner, competitors: scan.competitors,
    questions: scan.questions, models: scan.models, runs: scan.runs, answers,
  });
  return { ...scored, fixes: sampleFixes(scored) };
}
