# Master Key App — Build Plan & Spec

A single build brief for the Master Key practice app. Drop this file at the root of the repo; it's written so Claude Code (in VS Code) can execute against it step by step.

---

## 1. What the app is

A **phone-first Progressive Web App (PWA)** — a website that installs to your home screen and runs like a native app — supporting daily practice of the 26-week Master Key attention curriculum. Four modules:

1. **Timer / Stopwatch** — a stopwatch for free (open-ended) timing, and a countdown timer for set-length exercises.
2. **The Manual** — the full `master-key-manual.md`, bundled in and searchable, always available offline.
3. **Session Log** — record each session (date, minutes, attention score 1–5, one-word note); track the current week and the 7-tick unlock rule.
4. **AI Chat** — a manual-aware Claude assistant you can ask questions of, answered from the manual and your current week.

---

## 2. Architecture (decided)

| Concern | Choice | Why |
|---|---|---|
| App type | Phone-first PWA | Installable, offline-capable, works on desktop too |
| Frontend | Vite + React | Fast, simple, well-supported by Claude Code |
| Hosting | **Vercel** (from GitHub repo) | Free; serves static app **and** the proxy function; auto-deploys on push |
| AI access | **Google Gemini free tier** via a **serverless proxy** | Genuinely $0, no credit card; the proxy keeps the API key server-side |
| AI context | **Whole manual stuffed into every request** | Gemini's ~1M-token window easily holds the full ~26k-token manual, so the assistant answers directly from it |
| Data storage | `localStorage` (browser) to start | No backend/login needed; simplest for personal use |

**AI provider — default and alternatives.** The in-app chat is *grounded*: the model is handed the manual text and answers from it rather than from training memory. This is what makes it a real Master Key guide.

- **Default: Google Gemini free tier** (key from aistudio.google.com). Free, no credit card, and its ~1-million-token context window swallows the entire manual on every request — so we simply stuff the whole manual in, no chunking. Model: `gemini-2.5-flash` (or the current Flash).
- **Alternative free models (Mistral / Llama via OpenRouter):** also free, but smaller context windows (~8k–32k tokens), so the full manual may not fit. If used, send only the **current week's chapter + search-matched sections** instead of the whole manual (retrieval).
- **Optional paid upgrade (Anthropic / Claude):** for more nuanced answers, swap in the Anthropic API later. Grounding fixes factual accuracy on any model; Claude/Gemini add reasoning quality.

The key lives **only** as a Vercel environment variable — never in the frontend code or the repo. Because the proxy just abstracts "send messages + manual, get reply," switching providers later is a one-file change, not a rewrite.

---

## 3. Repo structure

```
master-key-app/
├─ README.md
├─ master-key-app-plan.md      ← this file
├─ index.html
├─ package.json
├─ vite.config.js              ← includes vite-plugin-pwa
├─ public/
│  ├─ manifest.webmanifest
│  └─ icons/                   ← 192px & 512px app icons
├─ src/
│  ├─ main.jsx
│  ├─ App.jsx                  ← tab shell (Timer | Manual | Log | Chat)
│  ├─ content/
│  │  └─ manual.md             ← copy of master-key-manual.md, imported as text
│  ├─ components/
│  │  ├─ Timer.jsx             ← stopwatch + countdown
│  │  ├─ Manual.jsx            ← renders + searches the manual
│  │  ├─ SessionLog.jsx        ← logging + week tracking
│  │  └─ Chat.jsx              ← chat UI, calls /api/chat
│  └─ lib/
│     ├─ storage.js            ← localStorage helpers
│     └─ manual.js             ← parse manual into weeks/sections
└─ api/
   └─ chat.js                  ← Vercel serverless proxy to Anthropic
```

---

## 4. Feature specs

### 4.1 Timer / Stopwatch
- **Stopwatch mode:** start / pause / reset, counts up, no alarm. Large, legible display for phone.
- **Timer mode:** pick a duration (presets: 15 / 20 / 30 min per the manual's guidance, plus custom), counts down, gentle sound + vibration on finish.
- Keep the screen awake during a session (Wake Lock API) so the phone doesn't sleep mid-practice.
- On finish, offer a one-tap "Log this session" that pre-fills the minutes into the Session Log.

### 4.2 The Manual
- Bundle `manual.md` and render it (e.g. `react-markdown`). Works fully offline.
- **Jump-to-week** navigation (Weeks 1–26) and a **text search** box.
- Show the **current week prominently** (linked to the Session Log's week tracker) so the day's exercise is one tap away.

### 4.3 Session Log
- One entry per session: **date**, **minutes**, **attention score 1–5**, **one-word note** — exactly the manual's four fields.
- Track the **active week** and a 7-box weekly tracker; **7 completed sessions unlocks the next week** (the manual's one rule). Don't auto-skip ahead.
- Simple history view; a small trend line of attention score over time is a nice-to-have.
- **Export to JSON/CSV** so data is portable and backup-able (localStorage can be cleared by the browser).

### 4.4 AI Chat (manual-aware)
- Chat UI posts the conversation to `/api/chat`.
- The proxy (`api/chat.js`) calls the **Gemini API** (`gemini-2.5-flash`) with:
  - a **system instruction** = "You are a guide for the Master Key practice…" **plus the full manual text** (the whole `manual.md`, which fits easily in Gemini's context window);
  - optional context: the user's **current week** and recent log, so answers are personal.
- Keep the manual text as a single variable passed into the request, so switching providers/models later is trivial.
- The API key is read from `process.env.GEMINI_API_KEY` on Vercel — never shipped to the browser.
- (Optional) stream the response for a more responsive feel.

---

## 5. Execution roadmap (order for Claude Code)

1. **Create the GitHub repo** (`master-key-app`) and clone it in VS Code.
2. **Scaffold**: `npm create vite@latest` (React), then add `vite-plugin-pwa`, `react-markdown`. Commit.
3. **Tab shell** (`App.jsx`): four tabs — Timer, Manual, Log, Chat — with a mobile bottom nav.
4. **Timer module** — stopwatch + countdown, wake-lock, finish sound/vibration.
5. **Manual module** — copy `master-key-manual.md` into `src/content/manual.md`, render + search + week nav.
6. **Session Log module** — the four-field log, week tracker, 7-tick unlock, JSON/CSV export.
7. **PWA polish** — `manifest.webmanifest`, app icons, offline caching so it installs on your phone.
8. **Deploy to Vercel** — import the GitHub repo at vercel.com; it auto-builds and gives a live URL. Every `git push` redeploys.
9. **AI proxy** — add `api/chat.js`; set `GEMINI_API_KEY` in Vercel's Environment Variables (get a free key at aistudio.google.com — no credit card).
10. **Chat module** — wire `Chat.jsx` to `/api/chat`, pass current week as context, test on your phone.

Ship modules 1–7 first (fully usable with no AI cost), then add 8–10.

---

## 6. Open items to decide later
- **Backup/sync:** localStorage is per-device. If you want your log to survive a browser wipe or sync across devices, add a lightweight backend later (e.g. Supabase free tier). Not needed for v1 — the JSON/CSV export covers backup.
- **Reminders:** a daily practice nudge would need push notifications (more setup) or just a calendar habit. Optional.
- **Model choice:** start on Gemini free (`gemini-2.5-flash`). If you outgrow the free rate limits or want more nuanced answers, swap in the Anthropic API (Claude) by editing only `api/chat.js`.
```
