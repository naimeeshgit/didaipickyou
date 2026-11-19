import type { ToolId } from "./config";

export type QuestionType = "category" | "problem" | "comparison" | "feature";

export interface Question {
  text: string;
  type: QuestionType;
}

export interface Brand {
  name: string;
  aliases: string[];
}

export interface Design {
  id: string;
  url: string;
  domain: string;
  brand: Brand;
  category: string;
  oneLiner: string;
  audience: string;
  competitors: Brand[];
  questions: Question[];
  facts: string[];
  sample?: boolean;
}

export interface Source {
  url: string;
  title?: string;
  domain: string;
}

export interface BrandHit {
  name: string;
  position: number; // 1 = first brand named in the answer
}

export interface AnswerAnalysis {
  targetSentiment: "positive" | "neutral" | "negative" | "not_mentioned";
  targetRecommended: boolean;
  topPick: string | null;
  claims: { claim: string; verdict: "supported" | "contradicted" | "unverifiable" }[];
}

export interface AnswerRecord {
  q: number;
  tool: ToolId;
  run: number;
  model: string;
  text: string;
  sources: Source[];
  hits: BrandHit[];
  analysis: AnswerAnalysis;
  error?: string;
  cached?: boolean;
}

export interface Fix {
  title: string;
  evidence: string;
  action: string;
  impact: "high" | "medium" | "low";
}

export interface BrandScore {
  name: string;
  isTarget: boolean;
  mentions: number; // answers that name the brand
  pickRate: number; // share of answers that name the brand (0-1)
  firstRate: number; // share of answers where it is named first
  shareOfVoice: number; // share of all brand mentions (0-1)
}

export interface Report {
  scanId: string;
  createdAt: string;
  sample: boolean;
  url: string;
  domain: string;
  brand: Brand;
  category: string;
  oneLiner: string;
  competitors: Brand[];
  questions: Question[];
  models: Record<ToolId, string>;
  runs: number;
  totalAnswers: number;
  failedAnswers: number;
  scores: BrandScore[];
  byTool: { tool: ToolId; pickRate: number; answers: number }[];
  byType: { type: QuestionType; pickRate: number; answers: number }[];
  consistency: number; // share of question+tool pairs where all runs agree on mentioning the target
  sentiment: Record<AnswerAnalysis["targetSentiment"], number>;
  gaps: { q: number; question: string; type: QuestionType; winners: string[]; tools: ToolId[] }[];
  topSources: { domain: string; count: number; withTarget: number }[];
  flaggedClaims: { claim: string; tool: ToolId; q: number }[];
  fixes: Fix[];
  answers: AnswerRecord[];
}
