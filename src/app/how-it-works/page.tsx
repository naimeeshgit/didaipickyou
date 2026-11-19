import type { Metadata } from "next";
import Link from "next/link";
import { config } from "@/lib/config";

export const metadata: Metadata = {
  title: "How it works",
  description: "How Did AI Pick You? measures whether ChatGPT, Claude and Gemini recommend your brand, and the limits of the method.",
};

export default function HowItWorks() {
  const steps = [
    ["Read your website", `A strong AI model reads your home page and identifies your category, buyers and the competitors buyers compare you with. It also notes checkable facts about you, such as integrations and pricing model.`],
    ["Write buyer questions", `It writes ${config.questionsPerScan} questions in the words buyers use: best-of questions, problem questions, comparisons and feature questions. Best-of, problem and feature questions never name your brand, so you only get credit when AI brings you up on its own. You can edit every question.`],
    ["Ask the assistants", `Each question goes to ChatGPT, Claude and Gemini through their APIs, with web search on, ${config.runsPerQuestion} times each. AI answers change from run to run, so asking more than once shows how stable your position is.`],
    ["Count and check", `Brand mentions and their order are counted in code, not guessed by AI. A small AI model then reads each answer that names you for sentiment and for claims that conflict with your website.`],
    ["Turn it into fixes", `A strong model reads the findings and writes a short list of actions: comparison pages, sources to get listed on, facts to correct, and questions to answer with content.`],
  ];
  return (
    <div className="mx-auto max-w-3xl px-5 py-14">
      <h1 className="font-[family-name:var(--font-display)] text-5xl">How it works</h1>
      <ol className="mt-10 space-y-6">
        {steps.map(([t, d], i) => (
          <li key={t} className="rounded-2xl border border-line bg-white p-6">
            <p className="text-sm text-muted">Step {i + 1}</p>
            <h2 className="text-lg font-semibold mt-1">{t}</h2>
            <p className="mt-2 text-muted">{d}</p>
          </li>
        ))}
      </ol>
      <h2 className="mt-12 text-2xl font-semibold">What the numbers mean</h2>
      <ul className="mt-4 space-y-3 text-muted list-disc pl-5">
        <li><strong className="text-ink">Pick rate</strong>: the share of answers that name a brand.</li>
        <li><strong className="text-ink">Named first</strong>: the share of answers where the brand is the first one named.</li>
        <li><strong className="text-ink">Share of voice</strong>: a brand&apos;s share of all brand mentions across the answers.</li>
        <li><strong className="text-ink">Runs agree</strong>: how often repeated runs of the same question gave the same result for your brand.</li>
      </ul>
      <h2 className="mt-12 text-2xl font-semibold">Limits</h2>
      <ul className="mt-4 space-y-3 text-muted list-disc pl-5">
        <li>API answers can differ from the ChatGPT, Claude and Gemini apps, which may personalise answers. Treat results as a trend.</li>
        <li>A scan is a sample of {config.questionsPerScan} questions, not every question buyers ask.</li>
        <li>Answers are cached for the current week, so repeating a scan in the same week costs nothing and gives the same answers.</li>
      </ul>
      <Link href="/scan" className="inline-block mt-10 rounded-full bg-ink text-paper px-6 py-3 hover:bg-accent">Check my brand</Link>
    </div>
  );
}
