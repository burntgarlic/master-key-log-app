# Master Key App — Step-by-Step Setup Guide

A click-by-click walkthrough, assuming you're starting from scratch. Do the parts in order. You can stop after **Part 5** and have a working app on your phone with no AI; **Parts 6–7** add the free AI chat.

Throughout, when you see `like this`, it's something to type into a terminal (press Enter after each line).

---

## Part 0 — Install the four tools (one-time)

Install these in order. Accept the default options in each installer.

1. **Node.js** (runs the app's build tools) — go to <https://nodejs.org> and download the **LTS** version. Install it.
2. **Git** (version control, talks to GitHub) — go to <https://git-scm.com/downloads> and install for your OS.
3. **VS Code** (the editor) — go to <https://code.visualstudio.com> and install.
4. **Claude Code** (your AI builder inside VS Code) — you'll install this in Part 3.

**Check it worked:** open VS Code, then open its terminal (menu **Terminal → New Terminal**) and type:

```
node -v
git -v
```

Each should print a version number. If they do, you're set.

---

## Part 1 — Create your GitHub account and repository

1. Go to <https://github.com> and **sign up** (skip if you already have an account).
2. Once logged in, click the **+** icon top-right → **New repository**.
3. Fill in:
   - **Repository name:** `master-key-app`
   - **Description:** (optional) "Master Key practice app"
   - Choose **Private** (only you) or **Public** — either is fine.
   - Tick **Add a README file**.
4. Click **Create repository**.
5. On the new repo's page, click the green **Code** button → **HTTPS** tab → copy the URL (looks like `https://github.com/yourname/master-key-app.git`). Keep it handy.

---

## Part 2 — Get the project onto your computer

1. In VS Code: **File → Open Folder**, and pick (or make) a folder where you keep projects, e.g. `Documents`.
2. Open the terminal (**Terminal → New Terminal**) and clone your repo (paste the URL you copied):

```
git clone https://github.com/yourname/master-key-app.git
```

3. Open the freshly cloned folder: **File → Open Folder** → select `master-key-app`.
4. Copy the two planning files and the manual into this folder so Claude Code can see them. Put these three files in the `master-key-app` folder:
   - `master-key-app-plan.md`
   - `SETUP-GUIDE.md` (this file)
   - `master-key-manual.md`

   (Easiest way: drag them from your file explorer into the VS Code file list on the left.)

---

## Part 3 — Install and start Claude Code

1. In the VS Code terminal, install Claude Code globally:

```
npm install -g @anthropic-ai/claude-code
```

2. Start it by typing:

```
claude
```

3. The first time, it will ask you to **log in** — follow the prompt to sign in with your Claude account (your existing Claude Pro/Max plan covers using Claude Code; this is *separate* from the app's Gemini AI). 

> Note: Claude Code = the AI that *builds* your app. Gemini free = the AI that *lives inside* your app and answers Master Key questions. Different things.

---

## Part 4 — Have Claude Code build the app

You'll drive Claude Code by chatting with it in the terminal. Point it at the plan first, then build module by module (this keeps it manageable and easy to test). Paste these prompts one at a time, testing after each.

**Prompt 1 — orient it:**
```
Read master-key-app-plan.md and master-key-manual.md. This is the app we're building. Confirm you understand the architecture, then scaffold the project: a Vite + React app configured as a phone-first PWA, with a bottom-tab shell for Timer, Manual, Log, and Chat. Don't build the module internals yet.
```

**Prompt 2 — the timer:**
```
Build the Timer module per section 4.1 of the plan: a stopwatch (count up, no alarm) and a countdown timer (presets 15/20/30 min plus custom), with a wake lock so the screen stays on, and a gentle sound + vibration when the countdown finishes.
```

**Prompt 3 — the manual:**
```
Build the Manual module per section 4.2: copy master-key-manual.md into src/content/manual.md, render it with search and week (1–26) navigation, working fully offline.
```

**Prompt 4 — the log:**
```
Build the Session Log module per section 4.3: log date, minutes, attention score 1–5, and a one-word note; track the active week with a 7-session unlock rule; store in localStorage; add JSON/CSV export.
```

**Prompt 5 — run it locally:**
```
Start the dev server so I can preview the app.
```
Claude Code will give you a local address (like `http://localhost:5173`). Open it in your browser to try the app. To view it on your **phone on the same Wi-Fi**, ask:
```
Expose the dev server on my local network so I can open it on my phone.
```

Test the timer, manual, and log. When you're happy, move on to publishing.

---

## Part 5 — Save your work to GitHub

After each working chunk, save it. In the terminal:

```
git add .
git commit -m "Add timer, manual, and log modules"
git push
```

(The first `git push` may ask you to authorize — follow the prompt. Once done, refresh your GitHub repo page in the browser and you'll see your files there.)

---

## Part 6 — Publish it free on Vercel

1. Go to <https://vercel.com> and click **Sign Up** → **Continue with GitHub** (authorize it).
2. On your Vercel dashboard, click **Add New… → Project**.
3. Find `master-key-app` in the list and click **Import**.
4. Vercel auto-detects Vite. Leave the defaults and click **Deploy**.
5. After a minute you'll get a live URL like `https://master-key-app.vercel.app`. Open it — your app is now public on the internet.
6. **Install it on your phone:** open that URL in your phone's browser → browser menu → **Add to Home Screen**. It now behaves like an app.

From now on, every time you `git push`, Vercel automatically rebuilds and updates the live site. No manual publishing step.

---

## Part 7 — Add the free Gemini AI chat

**7a. Get your free Gemini key**
1. Go to <https://aistudio.google.com> and sign in with a Google account.
2. Click **Get API key** → **Create API key**. No credit card required.
3. Copy the key (a long string). Treat it like a password — don't paste it into code or share it.

**7b. Give the key to Vercel (safely)**
1. In Vercel, open your project → **Settings → Environment Variables**.
2. Add a new variable:
   - **Name:** `GEMINI_API_KEY`
   - **Value:** paste your key
3. Save.

**7c. Have Claude Code build the chat**
Back in the VS Code terminal, in `claude`:
```
Build the AI Chat module per section 4.4 of the plan. Add a Vercel serverless function at api/chat.js that calls Gemini (gemini-2.5-flash), reading the key from process.env.GEMINI_API_KEY, and passes the entire manual.md text plus my current week as context so it answers as a Master Key guide. Then build the Chat.jsx UI that talks to /api/chat. Keep the manual text as a single variable so I can swap the model later.
```

**7d. Ship it**
```
git add .
git commit -m "Add Gemini-powered chat"
git push
```
Vercel redeploys automatically. Reload the app on your phone and test the chat — ask it something like *"What's the week 6 exercise and what am I training?"* to confirm it's reading the manual.

---

## The everyday loop (after setup)

Once it's all up, your routine for any change is just:

1. Open the project in VS Code, run `claude`, and describe the change you want.
2. Preview locally if you like.
3. `git add .` → `git commit -m "what changed"` → `git push`.
4. Vercel updates the live app within a minute.

---

## If something breaks
- **A terminal command "isn't recognized":** you likely need to close and reopen VS Code after installing Node/Git so it picks them up.
- **Anything else:** paste the exact error text into `claude` and ask it to fix it — describing the error is usually enough for it to resolve.
