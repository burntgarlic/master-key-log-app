// REPL driver for the Master Key app (Vite + React, browser-only — no
// chromium-cli in this environment, so this is a thin hand-rolled analog
// using Playwright's `chromium` module directly). Commands are read one
// per line from stdin and executed IN ORDER, even when the whole script
// arrives at once via a piped heredoc — a plain readline 'line' handler
// would race (e.g. `nav` firing before `launch` finishes), so lines are
// pushed onto a serial promise queue instead of awaited inline.
import { chromium } from 'playwright'
import * as readline from 'node:readline'
import * as fs from 'node:fs'
import * as path from 'node:path'

const SHOT_DIR = process.env.SCREENSHOT_DIR
  || path.resolve(import.meta.dirname, 'screenshots')
fs.mkdirSync(SHOT_DIR, { recursive: true })

let browser = null
let context = null
let page = null
const consoleErrors = []

function requirePage() {
  if (!page) throw new Error('no page — run `launch <url>` first')
  return page
}

const COMMANDS = {
  async launch(url) {
    if (browser) return console.log('already launched')
    browser = await chromium.launch({ headless: true })
    context = await browser.newContext()
    page = await context.newPage()
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => consoleErrors.push(String(err)))
    if (url) await page.goto(url, { waitUntil: 'domcontentloaded' })
    console.log('launched' + (url ? `, navigated to ${url}` : ''))
  },

  async nav(url) {
    await requirePage().goto(url, { waitUntil: 'domcontentloaded' })
    console.log('nav →', url)
  },

  // Accepts a CSS selector, or `text=Some Text` to wait for the text to
  // appear anywhere in the page (mirrors chromium-cli's `wait-for text=...`).
  // Checks document.body.textContent as a whole rather than any single
  // element's — text is often split across nested tags (e.g. `<span>Label:
  // <strong>value</strong></span>`), so no individual element, leaf or not,
  // necessarily contains the full needle.
  async ['wait-for'](spec) {
    const p = requirePage()
    try {
      if (spec.startsWith('text=')) {
        const needle = spec.slice(5)
        await p.waitForFunction(
          (t) => document.body.textContent?.includes(t),
          needle,
          { timeout: 10_000 },
        )
      } else {
        await p.waitForSelector(spec, { timeout: 10_000 })
      }
      console.log('found:', spec)
    } catch {
      console.log('TIMEOUT:', spec)
    }
  },

  async click(selector) {
    await requirePage().click(selector)
    console.log('click', selector)
  },

  async ['click-text'](text) {
    const p = requirePage()
    const result = await p.evaluate((t) => {
      const els = [...document.querySelectorAll('button, a, [role="button"]')]
      const el = els.find((e) => e.textContent?.trim() === t)
        ?? els.find((e) => e.textContent?.includes(t))
      if (!el) return 'NOT_FOUND'
      el.click()
      return 'OK: ' + el.tagName
    }, text)
    console.log('click-text', JSON.stringify(text), '→', result)
  },

  async fill(rest) {
    const [selector, ...valueParts] = rest.split(' ')
    await requirePage().fill(selector, valueParts.join(' '))
    console.log('fill', selector)
  },

  async press(key) {
    await requirePage().keyboard.press(key)
    console.log('press', key)
  },

  async ss(name) {
    const file = path.join(SHOT_DIR, (name || `ss-${Date.now()}`) + '.png')
    await requirePage().screenshot({ path: file })
    console.log('screenshot:', file)
  },

  async text(selector) {
    const p = requirePage()
    const result = await p.evaluate(
      (s) => (s ? document.querySelector(s) : document.body)?.innerText ?? '(null)',
      selector || null,
    )
    console.log(result)
  },

  async eval(expr) {
    try {
      console.log(JSON.stringify(await requirePage().evaluate(expr)))
    } catch (e) {
      console.log('ERROR:', e.message)
    }
  },

  async console(flag) {
    if (flag === '--errors' || !flag) {
      console.log(consoleErrors.length ? consoleErrors.join('\n') : '(no console errors)')
    }
  },

  // For PWA offline-cache verification: go offline, reload, confirm the
  // app still renders from the service worker cache instead of failing.
  async offline() {
    if (!context) return console.log('ERROR: launch first')
    await context.setOffline(true)
    console.log('offline: true')
  },

  async online() {
    if (!context) return console.log('ERROR: launch first')
    await context.setOffline(false)
    console.log('offline: false')
  },

  async reload() {
    await requirePage().reload({ waitUntil: 'domcontentloaded' })
    console.log('reloaded')
  },

  async quit() {
    if (browser) await browser.close().catch(() => {})
    browser = null
    context = null
    page = null
  },

  help() {
    console.log('commands:', Object.keys(COMMANDS).join(', '))
  },
}

const stdin = process.stdin
const rl = readline.createInterface({ input: stdin, output: process.stdout, prompt: 'driver> ' })

// Serial queue: each line's handler must finish before the next one starts,
// even though all lines of a piped heredoc arrive in one burst.
let queue = Promise.resolve()

rl.on('line', (line) => {
  queue = queue.then(async () => {
    const trimmed = line.trim()
    if (!trimmed) return
    const [cmd, ...rest] = trimmed.split(/\s+/)
    const fn = COMMANDS[cmd]
    if (!fn) {
      console.log('unknown:', cmd, '— try: help')
      return
    }
    try {
      await fn(rest.join(' '))
    } catch (e) {
      console.log('ERROR:', e.message)
    }
    if (cmd === 'quit') {
      rl.close()
    }
  })
})

rl.on('close', async () => {
  await queue.catch(() => {})
  await COMMANDS.quit()
  process.exit(0)
})

console.log('master-key-app driver — "help" for commands, "launch <url>" to start')
