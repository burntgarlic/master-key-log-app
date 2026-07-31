import { useState } from 'react'
import './App.css'
import Timer from './components/Timer.jsx'
import Manual from './components/Manual.jsx'
import SessionLog from './components/SessionLog.jsx'
import Chat from './components/Chat.jsx'
import DevPanel from './components/DevPanel.jsx'

const TABS = [
  { id: 'timer', label: 'Timer', icon: '⏱', Component: Timer },
  { id: 'manual', label: 'Manual', icon: '📖', Component: Manual },
  { id: 'log', label: 'Log', icon: '📝', Component: SessionLog },
  { id: 'chat', label: 'Chat', icon: '💬', Component: Chat },
]

// Statically known at build time (see vite.config.js define) — the literal
// string substitution lets the bundler prove this branch is unreachable in
// a production build and eliminate DevPanel's code entirely, not just skip
// rendering it at runtime.
const VERCEL_ENV = import.meta.env.VITE_VERCEL_ENV
const SHOW_DEV_PANEL = VERCEL_ENV === 'preview' || VERCEL_ENV === 'development'

export default function App() {
  const [activeTab, setActiveTab] = useState('timer')
  const active = TABS.find((tab) => tab.id === activeTab)
  const ActiveComponent = active.Component

  return (
    <div className="app-shell">
      <main className="app-content">
        <ActiveComponent onNavigate={setActiveTab} />
      </main>

      <nav className="bottom-nav">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`nav-item${tab.id === activeTab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            aria-current={tab.id === activeTab ? 'page' : undefined}
          >
            <span className="nav-icon" aria-hidden="true">{tab.icon}</span>
            <span className="nav-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {SHOW_DEV_PANEL && <DevPanel />}
    </div>
  )
}
