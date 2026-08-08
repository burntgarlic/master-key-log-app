import { useSyncExternalStore } from 'react'
import { getPracticeLength, setPracticeLength, getPracticeStyle, setPracticeStyle } from './storage.js'

// Shared reactive store for practice settings (length + style), so every
// consumer — the Home dashboard's "Begin practice" button, the Timer tab,
// and the settings form itself — re-renders the instant either value
// changes, with no page reload. Plain module-level state + a listener set
// (read via useSyncExternalStore) rather than React Context, matching this
// codebase's existing pattern for cross-cutting concerns that live outside
// any one component tree (see theme.js, cloudSync.js) — no Provider
// wrapper needed, any component can just call usePracticeSettings()
// directly.
//
// Initialized from localStorage at module load (effectively "app load",
// since this module is imported well before anything renders), so the
// first render everywhere already shows the persisted values.
let state = {
  length: getPracticeLength(),
  style: getPracticeStyle(),
}

const listeners = new Set()

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return state
}

// The one place these settings are written. Persists both to localStorage
// and swaps in a new state object (so useSyncExternalStore's Object.is
// check sees a real change) in one step, then notifies every subscriber —
// this is what makes a single Save apply everywhere immediately, with
// nothing left relying on a fresh mount/reload to pick it up.
export function savePracticeSettings({ length, style }) {
  setPracticeLength(length)
  setPracticeStyle(style)
  state = { length: getPracticeLength(), style: getPracticeStyle() }
  for (const listener of listeners) listener()
}

export function usePracticeSettings() {
  return useSyncExternalStore(subscribe, getSnapshot)
}
