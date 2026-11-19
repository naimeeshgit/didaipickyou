# Did AI Pick You?

Asks ChatGPT, Claude and Gemini the questions your buyers ask, and shows how often they recommend you, who they pick instead, which sources they cite, wrong facts about you, and what to fix.

## Run locally

```bash
npm install
cp .env.example .env.local   # keys optional
npm run dev
```

With no keys it runs in **sample mode** on your laptop only: a made-up brand (Quillnote) with made-up answers, so you can click through the flow for free. Sample mode never runs on the live site; there a missing key shows "Scanning isn't switched on yet".

## Deploy on Vercel

1. Push this folder to a new GitHub repo.
2. vercel.com → Add New Project → import the repo. Framework: Next.js (auto).
3. Storage tab → add **Neon Postgres**. It sets `DATABASE_URL` for you. Tables are created on first use.
4. Settings → Environment Variables: add the keys from `.env.example`. Never paste keys anywhere else.
5. Deploy. Then set `NEXT_PUBLIC_SITE_URL` to the live URL and redeploy.
6. Google Search Console → add the site → submit `/sitemap.xml`.

## Before real scans

- **Spend limits.** Set a monthly limit on each provider account (OpenAI, Anthropic, Google AI Studio) and keep auto-recharge off.
- **Anthropic web search** must be turned on in the Anthropic Console (Settings → Privacy / tools) or Claude answers will fail.
- **Check model IDs.** Defaults are in `src/lib/config.ts`. Set the env overrides to match what each consumer app currently uses.
- Rough cost: $1–4 per scan (120 answers with web search). Daily cap (`DAILY_SCAN_CAP`) and per-visitor cap stop runaway bills.

## Everstage case study on the home page

1. Open `/scan`, enter `everstage.com`, review the questions, run it.
2. Copy the report id from the URL (`/r/<id>`).
3. Set `FEATURED_SCAN_ID=<id>` in Vercel and redeploy.

Until you set it, the home page shows your newest real report. Before the first real scan it shows no report at all.

## How it works

| Step | Model | Where |
|---|---|---|
| Read site, find competitors, write 20 questions | `DESIGN_MODEL` (strong) | `src/lib/ai.ts` designScan |
| Answer each question, web search on, 2 runs | each app's default model | askAssistant |
| Brand mentions and order | plain code | `src/lib/detect.ts` |
| Sentiment and wrong claims | `ANALYSIS_MODEL` (cheap) | analyseAnswer |
| Fix list | `DESIGN_MODEL` | writeFixes |

The browser runs the 120 jobs 6 at a time through `/api/scans/[id]/ask`, so no single request hits Vercel's time limit.

**Cache:** site reads 24h, question sets 7 days, answers per ISO week (same question in the same week costs nothing), analysis 30 days.

**Public reports:** every real scan gets a page at `/r/<id>` with its own title and description, listed in the sitemap, so brand names can show up on Google.

## Safety

- Site reader blocks private/local addresses and limits redirects.
- Website text and AI answers are treated as data inside prompts, never as instructions.
- Visitor IPs are stored only as salted hashes.

## Later (parking lot)

Accounts, payments, scheduled weekly re-runs with trend charts, Perplexity as a 4th assistant.
