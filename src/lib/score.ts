import { TOOLS, type ToolId } from "./config";
import { detectBrands } from "./detect";
import type { AnswerRecord, Brand, BrandScore, Question, QuestionType, Report } from "./types";

type Base = Omit<Report, "scores" | "headToHead" | "unpromptedAnswers" | "byTool" | "byType" | "consistency" | "sentiment" | "gaps" | "topSources" | "flaggedClaims" | "fixes" | "totalAnswers" | "failedAnswers">;

export function scoreScan(base: Base): Omit<Report, "fixes"> {
  const ok = base.answers.filter((a) => !a.error);
  const target = base.brand.name;
  const brands: Brand[] = [base.brand, ...base.competitors];

  const named = (a: AnswerRecord, name: string) => a.hits.some((h) => h.name === name);

  // A question "prompts" the brand if it is a comparison or its wording names the brand.
  // Answers to those mention the brand for free, so they are kept out of the headline numbers.
  const prompted = (a: AnswerRecord) => {
    const q = base.questions[a.q];
    if (!q) return false;
    if (q.type === "comparison") return true;
    return detectBrands(`${q.text} ${a.asked ?? ""}`, [base.brand]).length > 0;
  };
  const free = ok.filter((a) => !prompted(a));
  const pool = free.length ? free : ok;
  const totalMentions = pool.reduce((s, a) => s + a.hits.length, 0) || 1;
  const isPick = (a: AnswerRecord, b: Brand) => {
    const p = a.analysis.topPick?.toLowerCase().trim();
    return !!p && [b.name, ...b.aliases].some((n) => n.toLowerCase() === p);
  };

  const scores: BrandScore[] = brands
    .map((b) => {
      const mentions = pool.filter((a) => named(a, b.name)).length;
      const first = pool.filter((a) => a.hits[0]?.name === b.name).length;
      const topPicks = pool.filter((a) => isPick(a, b)).length;
      return {
        name: b.name,
        isTarget: b.name === target,
        mentions,
        pickRate: pool.length ? mentions / pool.length : 0,
        firstRate: pool.length ? first / pool.length : 0,
        shareOfVoice: mentions / totalMentions,
        topPicks,
        topPickRate: pool.length ? topPicks / pool.length : 0,
      };
    })
    .sort((a, b) => b.pickRate - a.pickRate);

  // Head-to-head: in answers to questions that named the brand, whose side did AI take?
  const h2hList = ok.filter(prompted);
  const pickCounts = new Map<string, number>();
  for (const a of h2hList) {
    const b = brands.find((x) => isPick(a, x));
    const name = b?.name ?? (a.analysis.topPick ? "Another vendor" : "No clear pick");
    pickCounts.set(name, (pickCounts.get(name) ?? 0) + 1);
  }
  const headToHead = {
    answers: h2hList.length,
    picks: [...pickCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
  };

  const rate = (list: AnswerRecord[]) => (list.length ? list.filter((a) => named(a, target)).length / list.length : 0);

  const byTool = TOOLS.filter((t) => base.answers.some((a) => a.tool === t.id)).map((t) => {
    const list = pool.filter((a) => a.tool === t.id);
    return { tool: t.id, pickRate: rate(list), answers: list.length };
  });

  const types: QuestionType[] = ["category", "problem", "feature"];
  const byType = types
    .map((type) => {
      const list = pool.filter((a) => base.questions[a.q]?.type === type);
      return { type, pickRate: rate(list), answers: list.length };
    })
    .filter((t) => t.answers > 0);

  // Consistency: for each question and tool, do all runs agree on whether the target is named?
  const groups = new Map<string, boolean[]>();
  for (const a of pool) {
    const k = `${a.q}:${a.tool}`;
    groups.set(k, [...(groups.get(k) ?? []), named(a, target)]);
  }
  const multi = [...groups.values()].filter((v) => v.length > 1);
  const consistency = multi.length ? multi.filter((v) => v.every((x) => x === v[0])).length / multi.length : 1;

  const sentiment = { positive: 0, neutral: 0, negative: 0, not_mentioned: 0 };
  for (const a of ok) sentiment[a.analysis.targetSentiment]++;

  // Gaps: questions where competitors were named but the target never was.
  const gaps = base.questions
    .map((question: Question, q) => {
      const list = ok.filter((a) => a.q === q);
      if (!list.length || list.some((a) => named(a, target))) return null;
      const counts = new Map<string, number>();
      for (const a of list) for (const h of a.hits) counts.set(h.name, (counts.get(h.name) ?? 0) + 1);
      const winners = [...counts.entries()].sort((x, y) => y[1] - x[1]).map(([n]) => n).slice(0, 3);
      if (!winners.length) return null;
      const tools = [...new Set(list.map((a) => a.tool))] as ToolId[];
      return { q, question: question.text, type: question.type, winners, tools };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);

  const sourceMap = new Map<string, { count: number; withTarget: number }>();
  for (const a of ok) {
    const domains = new Set(a.sources.map((s) => s.domain).filter(Boolean));
    for (const d of domains) {
      const e = sourceMap.get(d) ?? { count: 0, withTarget: 0 };
      e.count++;
      if (named(a, target)) e.withTarget++;
      sourceMap.set(d, e);
    }
  }
  const topSources = [...sourceMap.entries()]
    .map(([domain, v]) => ({ domain, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const flaggedClaims = ok.flatMap((a) =>
    a.analysis.claims.filter((c) => c.verdict === "contradicted").map((c) => ({ claim: c.claim, tool: a.tool, q: a.q })),
  );

  return {
    ...base,
    totalAnswers: base.answers.length,
    failedAnswers: base.answers.length - ok.length,
    unpromptedAnswers: pool.length,
    scores,
    headToHead,
    byTool,
    byType,
    consistency,
    sentiment,
    gaps,
    topSources,
    flaggedClaims,
  };
}

/** The compact summary the fix-writer sees. */
export function summaryForFixes(r: Omit<Report, "fixes">) {
  return {
    brand: r.brand.name,
    category: r.category,
    note: "Scores count only questions that did not name the brand. headToHead covers questions that did.",
    scores: r.scores.map((s) => ({ name: s.name, named: `${s.mentions}/${r.unpromptedAnswers}`, topPicks: s.topPicks })),
    headToHead: r.headToHead,
    byTool: r.byTool.map((t) => ({ tool: t.tool, pickRate: +t.pickRate.toFixed(2) })),
    byType: r.byType.map((t) => ({ type: t.type, pickRate: +t.pickRate.toFixed(2) })),
    gaps: r.gaps.slice(0, 10).map((g) => ({ question: g.question, winners: g.winners })),
    topSources: r.topSources.slice(0, 8),
    flaggedClaims: r.flaggedClaims.slice(0, 8),
    sentiment: r.sentiment,
  };
}
