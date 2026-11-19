import type { Brand, BrandHit } from "./types";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Finds the first position of any of a brand's names in the text, as a whole word. */
function firstIndex(text: string, brand: Brand) {
  let best = -1;
  for (const name of [brand.name, ...brand.aliases]) {
    const n = name.trim();
    if (n.length < 2) continue;
    const m = new RegExp(`(^|[^\\p{L}\\p{N}])${escape(n)}(?=$|[^\\p{L}\\p{N}])`, "iu").exec(text);
    if (m) {
      const i = m.index + m[1].length;
      if (best === -1 || i < best) best = i;
    }
  }
  return best;
}

/** Deterministic brand detection: which brands an answer names, and in what order. */
export function detectBrands(text: string, brands: Brand[]): BrandHit[] {
  return brands
    .map((b) => ({ name: b.name, index: firstIndex(text, b) }))
    .filter((b) => b.index >= 0)
    .sort((a, b) => a.index - b.index)
    .map((b, i) => ({ name: b.name, position: i + 1 }));
}

export const domainFromUrl = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};
