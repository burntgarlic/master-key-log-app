---
name: run-master-key-app
description: Build, run, and drive the Master Key app (Vite + React PWA). Use when asked to start the dev server, build it, take a screenshot of its UI, or interact with the Timer/Manual/Log/Chat tabs.
---

This is a Vite + React web app (no chromium-cli available in this environment), driven headlessly via a small Playwright-based REPL at
`.claude/skills/run-master-key-app/driver.mjs`. Pipe a script to its stdin the same way you'd use chromium-cli; it launches Chromium, navigates, clicks, and screenshots against the running dev server.

All paths below are relative to the repo root.

## Prerequisites

Playwright and its Chromium binary are already project dev-dependencies once set up:

```bash
npm install                      # installs playwright (in devDependencies)
npx playwright install chromium  # downloads the browser binary (~300MB, one-time)
```

## Build

```bash
npm run build   # vite build — verifies the PWA plugin + bundle succeed
```

## Run (agent path)

1. Start the dev server in the background and wait for it to actually serve. **Vite auto-increments the port if 5173 is taken** — read the real port from its stdout, don't assume 5173:

```bash
npm run dev > /tmp/vite-dev.log 2>&1 &
disown
timeout 30 bash -c 'until grep -q "Local:" /tmp/vite-dev.log; do sleep 1; done'
sed -E 's/\x1b\[[0-9;]*[a-zA-Z]//g' /tmp/vite-dev.log | grep -o 'http://localhost:[0-9]*' | head -1
```

2. Drive it with the REPL driver — pipe a script to stdin, one command per line:

```bash
node .claude/skills/run-master-key-app/driver.mjs <<'EOF'
launch http://localhost:5173/
wait-for text=Stopwatch
ss 01-landing
console --errors
quit
EOF
```

Screenshots land in `.claude/skills/run-master-key-app/screenshots/` (override via `SCREENSHOT_DIR`).

Commands are serialized internally (a promise queue behind the `line` handler), so a whole heredoc arriving at once still executes in order — you don't need tmux or one-line-at-a-time sending.

### Commands

| command | what it does |
|---|---|
| `launch <url>` | launch headless Chromium, open a page, navigate to `<url>` |
| `nav <url>` | navigate the existing page |
| `wait-for <css-selector>` | wait up to 10s for a selector |
| `wait-for text=<text>` | wait up to 10s for `<text>` to appear anywhere in `document.body.textContent` |
| `click <css-selector>` | click via Playwright's `page.click` |
| `click-text <text>` | click the first button/link/`[role=button]` matching `<text>` (exact, then substring) |
| `fill <css-selector> <value>` | fill an input |
| `press <key>` | keyboard press (e.g. `Enter`) |
| `ss [name]` | screenshot → `screenshots/<name or timestamp>.png` |
| `text [css-selector]` | print `innerText` of selector (default: whole page) |
| `eval <js>` | evaluate an expression in the page, print JSON |
| `console --errors` | print collected `console.error`/pageerror output since launch |
| `offline` / `online` | toggle `context.setOffline` — for verifying PWA offline caching |
| `reload` | reload the current page (combine with `offline` to test the service worker cache) |
| `click-text-download <text> <filename>` | click a button/link matching `<text>` (same matching as `click-text`) and save the resulting browser download to `screenshots/<filename>` — for verifying export/download buttons produce real, correct files |
| `grant <permission>` | grant a browser permission (e.g. `notifications`) for the current page's origin — needed before testing the Notification/Push APIs |
| `quit` | close the browser |

### PWA / offline verification

The service worker only activates against a **production build**, not `npm run dev` (no `devOptions.enabled` in `vite.config.js`). To confirm the app actually works offline:

```bash
npm run build
npm run preview > /tmp/vite-preview.log 2>&1 &
disown
timeout 30 bash -c 'until grep -q "Local:" /tmp/vite-preview.log; do sleep 1; done'
sed -E 's/\x1b\[[0-9;]*[a-zA-Z]//g' /tmp/vite-preview.log | grep -o 'http://localhost:[0-9]*' | head -1

node .claude/skills/run-master-key-app/driver.mjs <<'EOF'
launch http://localhost:4173/
wait-for text=Timer
eval navigator.serviceWorker.ready.then(() => 'sw-ready')
offline
reload
wait-for text=Timer
console --errors
quit
EOF
```

The first `launch` + `serviceWorker.ready` lets the SW install and precache before going offline; `reload` while offline proves the app is actually served from the cache, not the network.

### Stopping the dev server

```bash
netstat -ano | grep LISTENING | grep :5173   # find the PID on whatever port it bound
taskkill //PID <pid> //F
```

## Run (human path)

```bash
npm run dev   # prints a Local: http://localhost:XXXX/ URL — open it yourself
```

## Test

No test suite yet — the driver script above is the only automated verification in place.

---

## Gotchas

- **Vite's printed URL has ANSI color codes wrapping the port number** (`http://localhost:\x1b[1m5173\x1b[22m/`), so a naive `grep -o 'http://localhost:[0-9]*'` on the raw log matches zero digits and returns `http://localhost:` with nothing after the colon. Strip ANSI first with `sed -E 's/\x1b\[[0-9;]*[a-zA-Z]//g'` before grepping, as the command above does.
- **Vite silently moves ports.** If something is already listening on 5173 (a dev server left running from a previous session), Vite picks 5174+ without failing. Always read the actual port from the dev server's stdout rather than hardcoding 5173 — a stale server can otherwise make you drive/screenshot the wrong instance.
- **The driver launches a *persistent* context (`chromium.launchPersistentContext` with a throwaway temp profile dir), not `chromium.launch()` + `browser.newContext()`.** A plain `newContext()` is an incognito-style profile, and Chrome deliberately disables the Push API there with no way to feature-detect it (`AbortError: Registration failed - permission denied`, see https://crbug.com/41124656). A persistent context is a real (if temporary) Chrome profile as far as that check is concerned, so `pushManager.subscribe()` works. Don't revert this to a plain `newContext()` — it silently breaks any push-related testing.
- **Even with a persistent context, `pushManager.subscribe()` still fails in *headless* mode** with `AbortError: Registration failed - push service not available` — this is unrelated to network access (confirmed reachable via a `no-cors` fetch to `fcm.googleapis.com`) and specific to headless Chromium's push service integration. The driver itself stays headless by default (fine for everything else — offline caching, forms, exports, etc.), but a real end-to-end push test (subscribe → `web-push` send → SW receives it) needs a **separate, one-off script** with `chromium.launchPersistentContext(dir, { headless: false })`, run directly via `node` from the repo root (not through the driver) so `playwright`/`web-push` resolve from `node_modules`. This works fine on this native-Windows setup with no virtual display needed; document/adapt if running in a headless Linux container instead (would need Xvfb).
- **A plain `readline` `line` handler races a piped heredoc.** All lines of a heredoc arrive in one burst; if each `line` handler is `await`ed but not otherwise serialized, an async command like `launch` (which takes ~1s to boot Chromium) hasn't resolved before `nav`/`click` on the next line fire. The driver queues each line behind a running promise chain specifically to avoid this — don't remove that when editing the driver.
- **`click-text` on the bottom nav** matches by substring because each nav button's `textContent` is the emoji icon concatenated with the label (e.g. `⏱Timer`), not the label alone — exact-match would never hit.
- **The very first `launch` after a new npm dependency lands (e.g. adding `react-markdown`) triggers a forced full-page reload mid-session.** Vite's dev server pre-bundles deps on first request; if that discovers a new one, it logs `optimized dependencies changed. reloading` and reloads the page out from under you. Any command that fires in that instant throws `Execution context was destroyed, most likely because of a navigation`. Fix: put a `wait-for` right after `launch` (e.g. `wait-for text=Timer`) before doing anything else — `wait-for` retries across navigations, so it rides out the reload; a `click`/`eval` fired immediately does not.
- **`wait-for text=<text>` checks `document.body.textContent`, not any single element's.** An earlier version checked only leaf elements (`el.children.length === 0`), which missed text split across nested tags — e.g. `<span>Current week: <strong>1</strong></span>` has no leaf whose own text is "Current week: 1". Checking the whole body's text content instead is what actually mirrors "is this text visible on the page anywhere."
- **A file landing under `.claude/skills/*/screenshots/` while the dev server is running used to crash the whole `npm run dev` process on Windows** — a real, reproducible incident, not a hypothetical: driving `click-text-download` wrote `sessions.json` into that directory, Vite's file watcher tried to `fs.watch()` it, got `EBUSY` (Windows locks a file mid-write by another process), and the **uncaught** watcher error killed the Node process outright — not a warning, the server just disappeared (`ERR_CONNECTION_REFUSED` on the next request). Fixed in `vite.config.js` via `server.watch.ignored: ['**/.claude/**']`, so this whole directory is no longer watched. If you ever see the dev server vanish right after a screenshot/download command, check that this `ignored` entry is still in `vite.config.js` before assuming the app broke.
- **Testing the 7-tick unlock rule across multiple driver invocations resets progress, because each `launch` is a brand-new incognito-style browser context with empty `localStorage`.** Sessions logged in one `node driver.mjs <<'EOF' ... EOF` run don't carry over to the next one. Do a whole multi-step flow (e.g. logging 7 sessions to trigger the week unlock) in a single piped script, not split across separate invocations expecting shared state.

## Troubleshooting

- **`npx playwright install chromium` seems to hang:** it's downloading ~300MB (Chrome for Testing + headless shell); let it finish, it prints a progress bar.
- **Driver prints `no page — run \`launch <url>\` first`:** the `launch` command was never sent, or `quit` ran earlier in the same piped script and closed the browser before a later command.
- **`console --errors` prints nothing after a real error:** only `console.error(...)` calls and uncaught `pageerror`s are collected — `console.warn`/`log` are intentionally not included.
