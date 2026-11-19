// Rough AI cost tracking from token counts. List prices in USD per 1M tokens (Nov 2026).
// Unknown models are priced at a flagship rate so the estimate errs high, never low.

const PRICES: Record<string, [input: number, output: number]> = {
  "gpt-5.4-mini": [0.75, 4.5],
  "gpt-5.4-nano": [0.2, 1.25],
  "gpt-5.4": [2.5, 15],
  "gpt-6-astra": [10, 50],
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-sonnet-5-5": [2, 10],
  "claude-opus-5-5": [4, 20],
};
const FALLBACK: [number, number] = [10, 50];
export const SEARCH_USD = 0.01; // OpenAI and Anthropic web search: $10 per 1,000 calls

export type Meter = { usd: number; searches: number };
export const newMeter = (): Meter => ({ usd: 0, searches: 0 });

type Usage = { inputTokens?: number; outputTokens?: number };
type Result = { totalUsage?: Usage; usage?: Usage; steps?: { content?: { type: string; providerExecuted?: boolean }[] }[] };

/** Add one generateText call to the meter and return its cost. */
export function charge(meter: Meter | undefined, model: string, result: Result): number {
  const u = result.totalUsage ?? result.usage ?? {};
  const [pin, pout] = PRICES[model] ?? FALLBACK;
  const searches = (result.steps ?? [])
    .flatMap((s) => s.content ?? [])
    .filter((p) => p.type === "tool-call" && p.providerExecuted).length;
  const usd = ((u.inputTokens ?? 0) * pin + (u.outputTokens ?? 0) * pout) / 1e6 + searches * SEARCH_USD;
  if (meter) {
    meter.usd += usd;
    meter.searches += searches;
  }
  return usd;
}

export const fmtUsd = (x: number) => (x < 0.01 ? "under $0.01" : `$${x.toFixed(2)}`);
