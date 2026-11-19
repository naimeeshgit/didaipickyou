import { TOOLS, type ToolId } from "@/lib/config";
import type { Report } from "@/lib/types";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const toolLabel = (t: ToolId) => TOOLS.find((x) => x.id === t)?.label ?? t;
const typeLabel: Record<string, string> = {
  category: "Best-of questions",
  problem: "Problem questions",
  comparison: "Comparison questions",
  feature: "Feature questions",
};

function Bar({ value, strong }: { value: number; strong?: boolean }) {
  return (
    <div className="h-2.5 rounded-full bg-line/70 overflow-hidden">
      <div
        className={`h-full rounded-full ${strong ? "bg-accent" : "bg-ink/35"}`}
        style={{ width: `${Math.max(2, Math.round(value * 100))}%` }}
      />
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {note && <p className="text-sm text-muted mt-1">{note}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function ReportView({ report }: { report: Report }) {
  const target = report.scores.find((s) => s.isTarget)!;
  const rank = report.scores.findIndex((s) => s.isTarget) + 1;
  const leader = report.scores[0];
  const answered = report.totalAnswers - report.failedAnswers;
  const date = new Date(report.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 space-y-6">
      {report.sample && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Sample report.</strong> Every brand, answer and number here is made up, to show what a real report looks like.
        </div>
      )}

      {/* Headline */}
      <div className="rounded-3xl bg-ink text-paper p-8 md:p-10 grid md:grid-cols-[1.4fr_1fr] gap-8 items-end">
        <div>
          <p className="text-sm uppercase tracking-widest text-paper/60">AI visibility report · {report.category}</p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl md:text-5xl leading-tight">
            Did AI pick {report.brand.name}?
          </h1>
          <p className="mt-4 text-paper/80 max-w-xl">
            {target.pickRate >= leader.pickRate && target.isTarget
              ? `Yes, more often than any competitor. ChatGPT, Claude and Gemini named ${report.brand.name} in ${pct(target.pickRate)} of ${answered} answers.`
              : `Sometimes. ChatGPT, Claude and Gemini named ${report.brand.name} in ${pct(target.pickRate)} of ${answered} answers. ${leader.name} was named most, in ${pct(leader.pickRate)}.`}
          </p>
          <p className="mt-3 text-xs text-paper/50">
            {report.domain} · {date} · {report.questions.length} buyer questions × 3 assistants × {report.runs} runs
            {report.failedAnswers > 0 ? ` · ${report.failedAnswers} answers failed and are left out` : ""}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: "Pick rate", value: pct(target.pickRate) },
            { label: "Named first", value: pct(target.firstRate) },
            { label: `Rank of ${report.scores.length}`, value: `#${rank}` },
          ].map((m) => (
            <div key={m.label} className="rounded-2xl bg-paper/10 p-4">
              <div className="text-3xl font-semibold tabular">{m.value}</div>
              <div className="text-xs text-paper/60 mt-1">{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Section title="Who AI picks" note="Share of answers that name each brand.">
          <div className="space-y-3">
            {report.scores.map((s) => (
              <div key={s.name} className="grid grid-cols-[9rem_1fr_3.5rem] items-center gap-3 text-sm">
                <span className={`truncate ${s.isTarget ? "font-semibold text-accent" : ""}`}>{s.name}</span>
                <Bar value={s.pickRate} strong={s.isTarget} />
                <span className="tabular text-right">{pct(s.pickRate)}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted mt-4">
            Share of voice for {report.brand.name}: {pct(target.shareOfVoice)} of all brand mentions.
          </p>
        </Section>

        <Section title="By assistant and question type" note={`How often each one named ${report.brand.name}.`}>
          <div className="grid grid-cols-3 gap-3">
            {report.byTool.map((t) => (
              <div key={t.tool} className="rounded-xl border border-line p-4 text-center">
                <div className="text-2xl font-semibold tabular">{pct(t.pickRate)}</div>
                <div className="text-xs text-muted mt-1">{toolLabel(t.tool)}</div>
              </div>
            ))}
          </div>
          <div className="space-y-3 mt-5">
            {report.byType.map((t) => (
              <div key={t.type} className="grid grid-cols-[11rem_1fr_3.5rem] items-center gap-3 text-sm">
                <span>{typeLabel[t.type]}</span>
                <Bar value={t.pickRate} strong />
                <span className="tabular text-right">{pct(t.pickRate)}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-accent-soft px-3 py-1">Runs agree {pct(report.consistency)} of the time</span>
            <span className="rounded-full bg-pick-soft px-3 py-1">Positive mentions: {report.sentiment.positive}</span>
            <span className="rounded-full bg-line/60 px-3 py-1">Neutral: {report.sentiment.neutral}</span>
            <span className="rounded-full bg-miss-soft px-3 py-1">Negative: {report.sentiment.negative}</span>
          </div>
        </Section>
      </div>

      <Section title="What to fix first" note="Actions based on this scan, most important first.">
        <ol className="grid md:grid-cols-2 gap-4">
          {report.fixes.map((f, i) => (
            <li key={i} className="rounded-xl border border-line p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">
                  {i + 1}. {f.title}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${
                    f.impact === "high" ? "bg-accent text-white" : f.impact === "medium" ? "bg-accent-soft text-accent" : "bg-line/60"
                  }`}
                >
                  {f.impact} impact
                </span>
              </div>
              <p className="text-sm text-muted mt-2">{f.evidence}</p>
              <p className="text-sm mt-2">{f.action}</p>
            </li>
          ))}
        </ol>
      </Section>

      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6">
        <Section
          title="Where you're missing"
          note={`Questions where competitors were named and ${report.brand.name} never was.`}
        >
          {report.gaps.length === 0 ? (
            <p className="text-sm text-muted">No gaps: {report.brand.name} was named at least once for every question.</p>
          ) : (
            <ul className="divide-y divide-line">
              {report.gaps.map((g) => (
                <li key={g.q} className="py-3 text-sm">
                  <p>&ldquo;{g.question}&rdquo;</p>
                  <p className="text-muted mt-1">
                    AI picked: <span className="text-ink">{g.winners.join(", ")}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Sources AI cites" note="Websites the assistants used when answering. Being covered here helps.">
          {report.topSources.length === 0 ? (
            <p className="text-sm text-muted">No sources were returned.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-muted text-xs text-left">
                <tr>
                  <th className="pb-2 font-normal">Website</th>
                  <th className="pb-2 font-normal text-right">Answers</th>
                  <th className="pb-2 font-normal text-right">Named you</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {report.topSources.map((s) => (
                  <tr key={s.domain}>
                    <td className="py-2">{s.domain}</td>
                    <td className="py-2 text-right tabular">{s.count}</td>
                    <td className="py-2 text-right tabular">{s.withTarget}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {report.flaggedClaims.length > 0 && (
            <div className="mt-5 rounded-xl bg-miss-soft p-4">
              <p className="text-sm font-semibold text-miss">Claims that conflict with your website</p>
              <ul className="mt-2 space-y-1 text-sm">
                {[...new Map(report.flaggedClaims.map((c) => [c.claim, c])).values()].slice(0, 6).map((c, i) => (
                  <li key={i}>
                    &ldquo;{c.claim}&rdquo; <span className="text-muted">({toolLabel(c.tool)})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      </div>

      <Section title="Every answer" note="Open a question to read what each assistant said.">
        <div className="divide-y divide-line">
          {report.questions.map((question, q) => {
            const list = report.answers.filter((a) => a.q === q);
            const picked = list.filter((a) => a.hits.some((h) => h.name === report.brand.name)).length;
            return (
              <details key={q} className="py-3 group">
                <summary className="flex items-center justify-between gap-4 text-sm">
                  <span>
                    <span className="text-muted mr-2 text-xs uppercase tracking-wide">{question.type}</span>
                    {question.text}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs tabular ${
                      picked ? "bg-pick-soft text-pick" : "bg-miss-soft text-miss"
                    }`}
                  >
                    picked {picked}/{list.length}
                  </span>
                </summary>
                <div className="mt-3 grid md:grid-cols-3 gap-3">
                  {list.map((a) => (
                    <div key={`${a.tool}-${a.run}`} className="rounded-xl border border-line p-3 text-xs">
                      <p className="font-semibold">
                        {toolLabel(a.tool)} · run {a.run + 1}
                      </p>
                      <p className="text-muted mt-1">
                        {a.hits.length ? a.hits.map((h) => `${h.position}. ${h.name}`).join("  ") : "No tracked brands named"}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap line-clamp-[12]">{a.text}</p>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </Section>

      <p className="text-xs text-muted">
        Method: each question was sent to the {Object.entries(report.models).map(([t, m]) => `${toolLabel(t as ToolId)} (${m})`).join(", ")} APIs
        {report.sample ? "" : " with web search on"}. Brand mentions are counted in code; sentiment and claims are judged by a small AI
        model. API answers can differ from what people see in the consumer apps, so read these numbers as a trend.
      </p>
    </div>
  );
}
