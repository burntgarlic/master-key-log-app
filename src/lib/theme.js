// Persists and applies the user's theme choice. Only 'light' and 'dark' are
// ever written to localStorage/the DOM — 'system' (the default) is
// represented by their *absence*, since index.css's bare :root + the
// prefers-color-scheme media query already track the OS preference with
// pure CSS in that case, no JS involved. That's also what index.html's
// blocking inline script checks for on load, so this module and that
// script must stay in agreement on both the key name and this convention.
const THEME_KEY = 'mk_theme'

export function getThemePreference() {
  const raw = localStorage.getItem(THEME_KEY)
  return raw === 'light' || raw === 'dark' ? raw : 'system'
}

export function setThemePreference(pref) {
  if (pref === 'light' || pref === 'dark') {
    localStorage.setItem(THEME_KEY, pref)
    document.documentElement.setAttribute('data-theme', pref)
  } else {
    localStorage.removeItem(THEME_KEY)
    document.documentElement.removeAttribute('data-theme')
  }
  syncThemeColorMeta()
}

function resolvedTheme() {
  const explicit = document.documentElement.getAttribute('data-theme')
  if (explicit === 'light' || explicit === 'dark') return explicit
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

// Keeps the browser's own chrome (status bar / address bar on mobile) in
// sync with whichever theme is actually showing — cosmetic, not required
// for the page itself to render correctly (that's the data-theme
// attribute + CSS alone), but a mismatched theme-color reads as a bug.
function syncThemeColorMeta() {
  const meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) return
  meta.setAttribute('content', resolvedTheme() === 'light' ? '#f6f1e7' : '#14151a')
}

if (typeof window !== 'undefined') {
  syncThemeColorMeta()
  // "System" mode should keep tracking a live OS-level change (e.g. an
  // auto dark-mode schedule flipping at sunset) without needing a reload —
  // the CSS media query already repaints automatically; this just keeps
  // the meta tag from going stale alongside it.
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (getThemePreference() === 'system') syncThemeColorMeta()
  })
}
