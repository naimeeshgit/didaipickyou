"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Brand, Design, Question } from "@/lib/types";

type ToolId = "chatgpt" | "claude" | "gemini";
const TOOLS: { id: ToolId; label: string }[] = [
  { id: "chatgpt", label: "ChatGPT" },
  { id: "claude", label: "Claude" },
  { id: "gemini", label: "Gemini" },
];
type Job = { q: number; tool: ToolId; run: number };
type JobState = "waiting" | "asking" | "picked" | "missed" | "failed";

const splitList = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data as T;
}

export function ScanFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState<"input" | "designing" | "review" | "running" | "finishing">("input");
  const [error, setError] = useState("");
  const [url, setUrl] = useState(params.get("url") ?? "");
  const [brandHint, setBrandHint] = useState("");
  const [compHint, setCompHint] = useState("");

  const [design, setDesign] = useState<Design | null>(null);
  const [brand, setBrand] = useState<Brand>({ name: "", aliases: [] });
  const [competitors, setCompetitors] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [states, setStates] = useState<Record<string, JobState>>({});
  const [runs, setRuns] = useState(2);
  const [toolErrors, setToolErrors] = useState<Partial<Record<ToolId, string>>>({});
  const started = useRef(false);

  const runDesign = useCallback(async (target: string) => {
    setError("");
    setStep("designing");
    try {
      const d = await post<Design>("/api/design", {
        url: target,
        brand: brandHint || undefined,
        competitors: compHint ? splitList(compHint) : undefined,
      });
      setDesign(d);
      setBrand(d.brand);
      setCompetitors(d.competitors.map((c) => c.name).join(", "));
      setQuestions(d.questions);
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that website.");
      setStep("input");
    }
  }, [brandHint, compHint]);

  useEffect(() => {
    const u = params.get("url");
    if (u && !started.current) {
      started.current = true;
      runDesign(u);
    }
  }, [params, runDesign]);

  async function runScan() {
    if (!design) return;
    setError("");
    const compBrands: Brand[] = splitList(competitors).map((name) => {
      const known = design.competitors.find((c) => c.name.toLowerCase() === name.toLowerCase());
      return known ?? { name, aliases: [] };
    });
    let start: { scanId: string; jobs: Job[] };
    try {
      start = await post("/api/scans", {
        designId: design.id,
        brand,
        competitors: compBrands,
        questions: questions.filter((q) => q.text.trim().length >= 5),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the scan.");
      return;
    }
    setJobs(start.jobs);
    setRuns(Math.max(...start.jobs.map((j) => j.run)) + 1);
    setStates(Object.fromEntries(start.jobs.map((j) => [`${j.q}:${j.tool}:${j.run}`, "waiting" as JobState])));
    setStep("running");

    const queue = [...start.jobs];
    const worker = async () => {
      while (queue.length) {
        const j = queue.shift()!;
        const key = `${j.q}:${j.tool}:${j.run}`;
        setStates((s) => ({ ...s, [key]: "asking" }));
        let result: JobState = "failed";
        let lastError = "";
        for (let attempt = 0; attempt < 2 && result === "failed"; attempt++) {
          if (attempt > 0) await new Promise((r) => setTimeout(r, 4000));
          try {
            const r = await post<{ error: string | null; hits: { name: string }[] }>(`/api/scans/${start.scanId}/ask`, j);
            if (!r.error) result = r.hits.some((h) => h.name === brand.name) ? "picked" : "missed";
            else lastError = r.error;
          } catch (e) {
            lastError = e instanceof Error ? e.message : "Request failed";
          }
        }
        if (result === "failed" && lastError) setToolErrors((t) => (t[j.tool] ? t : { ...t, [j.tool]: lastError }));
        setStates((s) => ({ ...s, [key]: result }));
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));

    setStep("finishing");
    try {
      const { reportId } = await post<{ reportId: string }>(`/api/scans/${start.scanId}/finish`);
      router.push(`/r/${reportId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't build the report.");
      setStep("running");
    }
  }

  const values = Object.values(states);
  const doneCount = values.filter((v) => v === "picked" || v === "missed" || v === "failed").length;
  const picked = values.filter((v) => v === "picked").length;
  const answered = values.filter((v) => v === "picked" || v === "missed").length;

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      {error && <div className="mb-6 rounded-xl bg-miss-soft text-miss px-4 py-3 text-sm">{error}</div>}

      {step === "input" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim()) runDesign(url.trim());
          }}
          className="rounded-3xl border border-line bg-white p-8 space-y-5"
        >
          <h1 className="font-[family-name:var(--font-display)] text-4xl">Check your brand</h1>
          <p className="text-muted">Enter your website. We&apos;ll work out your category, competitors and the questions your buyers ask.</p>
          <label className="block">
            <span className="text-sm font-medium">Website</span>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="yourcompany.com" required
              className="mt-1 w-full rounded-xl border border-line px-4 py-3 outline-none focus:border-accent" />
          </label>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium">Brand name <span className="text-muted font-normal">(optional)</span></span>
              <input value={brandHint} onChange={(e) => setBrandHint(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line px-4 py-3 outline-none focus:border-accent" />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Competitors <span className="text-muted font-normal">(optional, comma separated)</span></span>
              <input value={compHint} onChange={(e) => setCompHint(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line px-4 py-3 outline-none focus:border-accent" />
            </label>
          </div>
          <button className="rounded-full bg-ink text-paper px-6 py-3 font-medium hover:bg-accent">Set up my scan</button>
        </form>
      )}

      {step === "designing" && (
        <div className="rounded-3xl border border-line bg-white p-10 text-center">
          <div className="mx-auto size-10 rounded-full border-4 border-accent-soft border-t-accent animate-spin" />
          <p className="mt-5 font-semibold">Reading the website and writing buyer questions…</p>
          <p className="text-sm text-muted mt-1">This takes about 20 seconds.</p>
        </div>
      )}

      {step === "review" && design && (
        <div className="space-y-6">
          {design.sample && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <strong>Sample mode.</strong> API keys aren&apos;t set, so this uses a made-up brand and made-up answers.
            </div>
          )}
          <div className="rounded-3xl border border-line bg-white p-8 space-y-5">
            <div>
              <p className="text-sm text-muted">{design.domain} · {design.category}</p>
              <h1 className="font-[family-name:var(--font-display)] text-3xl mt-1">Review your scan</h1>
              <p className="text-sm text-muted mt-2">{design.oneLiner}</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-medium">Your brand</span>
                <input value={brand.name} onChange={(e) => setBrand({ ...brand, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-line px-4 py-2.5 outline-none focus:border-accent" />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Competitors to compare</span>
                <input value={competitors} onChange={(e) => setCompetitors(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-line px-4 py-2.5 outline-none focus:border-accent" />
              </label>
            </div>
          </div>

          <div className="rounded-3xl border border-line bg-white p-8">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Buyer questions ({questions.length})</h2>
              <span className="text-xs text-muted">Edit any question. Best-of and problem questions don&apos;t name your brand.</span>
            </div>
            <ul className="mt-4 space-y-2">
              {questions.map((q, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-xs uppercase tracking-wide text-muted">{q.type}</span>
                  <input value={q.text}
                    onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                    className="flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent" />
                  <button type="button" aria-label="Remove question" onClick={() => setQuestions(questions.filter((_, j) => j !== i))}
                    className="text-muted hover:text-miss px-2">×</button>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setStep("input")} className="text-sm text-muted hover:text-ink">← Start over</button>
            <button onClick={runScan} disabled={!brand.name.trim() || questions.length < 3}
              className="rounded-full bg-ink text-paper px-6 py-3 font-medium hover:bg-accent disabled:opacity-40">
              Ask the assistants
            </button>
          </div>
        </div>
      )}

      {(step === "running" || step === "finishing") && (
        <div className="rounded-3xl border border-line bg-white p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-3xl">
                {step === "finishing" ? "Writing your report…" : "Asking the assistants…"}
              </h1>
              <p className="text-sm text-muted mt-1">{doneCount} of {jobs.length} answers in</p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-semibold tabular">{answered ? Math.round((picked / answered) * 100) : 0}%</div>
              <div className="text-xs text-muted">picked {brand.name} so far</div>
            </div>
          </div>
          {Object.entries(toolErrors).map(([t, msg]) => (
            <p key={t} className="mt-3 rounded-lg bg-miss-soft text-miss px-3 py-2 text-xs">
              <strong>{TOOLS.find((x) => x.id === t)?.label} failed:</strong> {msg}
            </p>
          ))}
          <div className="mt-4 h-2 rounded-full bg-line/70 overflow-hidden">
            <div className="h-full bg-accent transition-all" style={{ width: `${jobs.length ? (doneCount / jobs.length) * 100 : 0}%` }} />
          </div>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="text-left font-normal pb-2">Question</th>
                  {TOOLS.map((t) => <th key={t.id} className="font-normal pb-2 px-2">{t.label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {questions.map((q, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-4 max-w-md truncate">{q.text}</td>
                    {TOOLS.map((t) => (
                      <td key={t.id} className="px-2">
                        <div className="flex justify-center gap-1">
                          {Array.from({ length: runs }, (_, r) => {
                            const s = states[`${i}:${t.id}:${r}`];
                            const cls =
                              s === "picked" ? "bg-pick" : s === "missed" ? "bg-ink/25" : s === "failed" ? "bg-miss" : s === "asking" ? "bg-accent animate-pulse" : "bg-line";
                            return <span key={r} title={s} className={`size-3 rounded-full ${cls}`} />;
                          })}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-pick" />Named {brand.name}</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-ink/25" />Didn&apos;t</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-miss" />Failed</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
