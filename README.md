# Personal Cognitive Operating System

A private AI-powered self-improvement engine. Paste a YouTube URL → get a structured intelligence brief (executive summary, key ideas, frameworks, action steps, mental models, opportunities, behavioral shifts, the one insight that changes everything). Swipe a daily curated feed. Reflect. Track streaks and XP. Export PDFs.

Single-user. No auth. No login. 100% deployable on **Vercel + Supabase free tiers**. The only paid moving part is the Gemini API itself, and even that runs on its free tier.

---

## Stack

| Layer | Tool | Free? |
|---|---|---|
| App | Next.js 15 (App Router) + React 19 + TypeScript | yes |
| UI | Tailwind CSS, shadcn/ui, Framer Motion, Lucide | yes |
| Fonts | Google Fonts: Inter, Sora, Space Grotesk, Manrope | yes |
| DB | Supabase (Postgres) | yes (free tier) |
| AI — summarization | Gemini 2.5 Flash, **directly reading the YouTube URL** via `fileData` | yes (free tier) |
| AI — feed discovery | YouTube Data API v3 + RSS | yes (10k units/day) |
| PDF | `@react-pdf/renderer` | yes |
| Hosting | Vercel | yes (Hobby) |

Gemini reads the YouTube video itself — there is **no Python scraper**, no transcript extraction service, nothing to host separately. One repo, one Vercel project.

---

## Folder structure

```
.
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # fonts + theme + nav + toaster
│   │   ├── page.tsx                   # dashboard (server component)
│   │   ├── globals.css                # tailwind + design tokens
│   │   ├── summarize/                 # YouTube → insights
│   │   │   ├── page.tsx
│   │   │   └── summarize-client.tsx
│   │   ├── feed/                      # Tinder-style swipe feed
│   │   ├── library/                   # searchable archive
│   │   ├── insight/[id]/page.tsx      # full insight + reflection
│   │   └── api/
│   │       ├── summarize/route.ts     # Gemini reads the video → DB
│   │       ├── feed/route.ts
│   │       ├── feed/generate/route.ts # YouTube Data API + RSS aggregator + ranker
│   │       ├── reflection/route.ts
│   │       ├── save/route.ts
│   │       ├── swipe/route.ts
│   │       ├── watchlist/route.ts
│   │       └── pdf/[id]/route.ts      # @react-pdf renderer
│   ├── components/
│   │   ├── ui/                        # shadcn primitives
│   │   ├── nav.tsx
│   │   ├── stat-card.tsx
│   │   ├── summary-card.tsx
│   │   ├── insight-display.tsx
│   │   ├── reflection-prompt.tsx
│   │   ├── swipeable-feed.tsx
│   │   └── watchlist.tsx
│   └── lib/
│       ├── supabase.ts                # browser + server clients
│       ├── gemini.ts                  # Gemini client + JSON parser
│       ├── prompts.ts                 # system persona + insight prompt
│       ├── youtube.ts                 # YouTube Data API client
│       ├── pdf.tsx                    # @react-pdf document
│       ├── sources.ts                 # tracked channels + topic searches + filters
│       ├── dashboard.ts               # server data loader
│       ├── xp.ts / xp-server.ts       # gamification
│       ├── types.ts
│       └── utils.ts
├── SUPABASE_SCHEMA.sql                # paste into Supabase SQL editor
├── .env.example
├── package.json
├── tailwind.config.ts
├── next.config.ts
└── tsconfig.json
```

---

## Local setup (5 minutes, one-time)

### 0. Prerequisites

- **Node.js 20+** — `node -v`
- **A Gemini API key** — https://aistudio.google.com/apikey
- **A Supabase project** (free) — https://supabase.com → New Project
- **A YouTube Data API key** (free) — https://console.cloud.google.com/apis/credentials → Enable "YouTube Data API v3"

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Go to **https://supabase.com → your project → SQL Editor → + New query**.
2. Open `SUPABASE_SCHEMA.sql`, copy the entire file, paste it, click **RUN**. The script is idempotent — safe to re-run.
3. Verify all 8 tables under **Table Editor**:
   `summaries`, `saved_insights`, `swipe_history`, `user_preferences`, `daily_reflections`, `streaks`, `generated_feeds`, `recommendations`.
4. Go to **Project Settings → API** and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only — never expose)

### 3. Configure environment

```bash
cp .env.example .env.local
```

Then fill in `.env.local`:

```env
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash

NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

YOUTUBE_API_KEY=AIza...

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Run

```bash
npm run dev
# -> http://localhost:3000
```

### Smoke test

1. Open `http://localhost:3000`.
2. Click **Summarize a video** → paste a public YouTube URL (try a 5–15 min video first).
3. **Generate insight**. After 30–60s you'll see the structured brief.
4. Open `/feed` → click **Generate fresh feed** → swipe.

---

## Deploy to Vercel — step by step

This is the only deployment you need. No Render, no Railway, no separate Python service. Just Vercel + Supabase.

### Step 1 — Push the repo to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
# Create an empty repo on github.com first, then:
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

`.env.local` is already in `.gitignore` — your secrets will not be uploaded. Verify with `git status` before committing.

### Step 2 — Import the repo on Vercel

1. Go to https://vercel.com/new
2. Click **Import Project** → select your GitHub repo.
3. **Framework preset:** Next.js (auto-detected).
4. **Root directory:** leave at `./` (the repo root).
5. **Build command, install command, output directory:** leave at defaults.
6. **Do NOT click Deploy yet** — you need to add env vars first.

### Step 3 — Add environment variables

In the same import screen, expand **Environment Variables** and add each of these (paste the same values you have in `.env.local`):

| Name | Value | Environments |
|---|---|---|
| `GEMINI_API_KEY` | your Gemini key | Production, Preview, Development |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_URL` | your Supabase URL | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | your service-role key | Production, Preview, Development |
| `YOUTUBE_API_KEY` | your YouTube Data API key | Production, Preview, Development |
| `NEXT_PUBLIC_APP_URL` | leave blank for now (you'll get the URL after deploy) | Production, Preview, Development |

Click **Deploy**.

### Step 4 — First deploy

Vercel will install, build, and deploy in ~2 minutes. When done, you'll get a URL like `https://<your-project>.vercel.app`.

Open it. The dashboard, library, and feed pages should render. **Don't try to summarize yet** — first finish step 5.

### Step 5 — Set `NEXT_PUBLIC_APP_URL` and redeploy

1. Vercel → your project → **Settings → Environment Variables**.
2. Find `NEXT_PUBLIC_APP_URL`, click **Edit**, paste your `https://<your-project>.vercel.app` URL, save.
3. Go to **Deployments**, click the three-dot menu on the latest deployment → **Redeploy** → uncheck "Use existing build cache" → **Redeploy**.

This second deploy bakes the public URL into PDF/share links. You only need to do this once.

### Step 6 — Validate end-to-end on production

1. Open your `vercel.app` URL.
2. `/summarize` → paste a 5–10 minute YouTube video → **Generate insight**. Should return a brief in 30–60s.
3. `/feed` → **Generate fresh feed** → cards should populate with 1M+ view videos.
4. Swipe right on something → check the **Watchlist** appears on the dashboard.
5. Open any saved insight → **Export PDF** → verify the PDF downloads.

If summarize times out, see the next section.

---

## Vercel Hobby vs Pro — what about the 60-second timeout?

Vercel's **Hobby tier** caps serverless functions at **60 seconds**. Gemini takes roughly:

| Video length | Typical Gemini time | Fits in 60s? |
|---|---|---|
| 3–10 min | 25–45s | ✓ |
| 10–20 min | 40–70s | mostly ✓ |
| 20–40 min | 60–110s | sometimes ✗ |
| 40 min+ | 90s+ | ✗ on Hobby |

The codebase ships with `maxDuration = 60` on `/api/summarize` so it works on Hobby. If you upgrade to Vercel Pro ($20/mo), edit `src/app/api/summarize/route.ts` and bump it:

```ts
export const maxDuration = 300;
```

That gives you headroom for 1-hour videos.

For Hobby tier, prefer videos ≤20 minutes. Most high-density creator content (Hormozi, Ali Abdaal, James Clear) fits comfortably.

---

## Environment variables — reference

| Variable | Required | What it's for |
|---|---|---|
| `GEMINI_API_KEY` | yes | Gemini key from `aistudio.google.com/apikey`. |
| `GEMINI_MODEL` | no | Defaults to `gemini-2.5-flash` (free tier). Use `gemini-2.5-pro` only if your Google Cloud project has billing enabled. |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Anon public key. Used on the browser. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-only. Bypasses RLS. **Never** expose to the client. |
| `YOUTUBE_API_KEY` | yes | YouTube Data API v3 key. Required for the curated feed (search.list + videos.list). Without it the feed falls back to RSS only. |
| `NEXT_PUBLIC_APP_URL` | no | Public URL of the deployed app. Used in PDF / share links. |

---

## How summarization works (no scraper needed)

```
┌────────────────┐  POST /api/summarize  ┌──────────────────┐
│   Browser      │ ────────────────────▶ │  Vercel route    │
│   (paste URL)  │                       │  /api/summarize  │
└────────────────┘                       └────────┬─────────┘
                                                  │
                       ┌──────────────────────────┴──┐
                       ▼                              ▼
            YouTube Data API v3              Gemini 2.5 Flash
            (title, author, thumb)           (reads the video
                       │                      directly via
                       │                      fileData.fileUri)
                       │                              │
                       └──────────────┬───────────────┘
                                      ▼
                                  Supabase
                                (insert summary)
                                      ▼
                              ┌───────────────┐
                              │   Browser     │
                              │  (renders     │
                              │   structured  │
                              │   insight)    │
                              └───────────────┘
```

Gemini's `fileData.fileUri` accepts any **public** YouTube URL and processes the video itself — audio + on-screen text + visuals. This is part of Gemini's video-understanding API and is on the free tier.

Gemini's free-tier YouTube limits:
- Up to **8 hours of YouTube video per day**, **per Google project**.
- **One video per request**.
- Public videos only — no private, unlisted, members-only, or age-gated.

For a single user this is more than enough.

---

## How the AI is *not* generic

`src/lib/prompts.ts` defines the persona and the schema. Notable choices:

- **Persona:** Naval/Munger/Thiel-style. No motivational-speaker tone. Honest if the source is shallow.
- **Plain English by default:** CEFR B1–B2, jargon replacements, concrete examples grounded in Pakistani builder/operator life.
- **Schema:** 13 sections including `business_opportunities`, `applicable_to_my_life`, `mental_models`, `execution_frameworks`, and the closer `one_insight_that_changes_everything`.
- **Hard constraints in the prompt** to avoid empty platitudes and fabricated quotes.
- **Topics auto-tagged** in the same call (no second Gemini round-trip), drawn from a controlled vocabulary.
- **Faithful to the creator** — explicit instruction to preserve the original framing.

---

## Curated feed

The feed is driven by the native YouTube Data API v3 (channels, playlistItems, and videos endpoints). Creator monitoring uses `playlistItems.list` (1 unit each, ~22/day). Topic search uses `search.list` (100 units each, ~800/day). Total daily quota usage: ~10% of the 10,000-unit free tier per session.
Creator handles can be updated in `src/lib/sources.ts` if a creator changes their handle, and resolution failures show up in `/api/feed/diagnostics`.

The feed enforces a hard 1,000,000+ view floor and a 180-second minimum duration on every card. Shorts are blocked at three layers (URL pattern, duration, search parameter).

---

## Daily routine (suggested)

1. Open `/feed` — swipe through 10–20 cards. Right-swipe what's worth your time, super-save the gold.
2. Go to the dashboard → the right-swiped videos appear in your **Watchlist**.
3. From the watchlist, click **Summarize** on the most-promising one. Read the brief → pick **one** action step → write your reflection: *"Today I will…"*.
4. Tomorrow morning, the dashboard shows your streak.

That's it. No notifications. No streaks-broke shaming. The system serves you, not the other way around.

---

## Scaling notes (later, not now)

This MVP intentionally avoids:
- Vector DB (Postgres `text[]` + Fuse.js gives plenty of search until ~5k summaries).
- Auth (it's personal — keep your URL private; rotate the Supabase anon key if leaked).
- Queueing (Gemini calls are sub-minute; Vercel Hobby allows 60s, Pro allows 300s).

If you ever outgrow these: pgvector + `summaries.embedding` → semantic search; Supabase Auth → multi-user; Inngest/Trigger.dev → background jobs.

---

## License

Personal use. Do whatever you want with it.
