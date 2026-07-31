import { useState } from 'react'
import './App.css'
import Timer from './components/Timer.jsx'
import Manual from './components/Manual.jsx'
import SessionLog from './components/SessionLog.jsx'
import Chat from './components/Chat.jsx'

const TABS = [
  { id: 'timer', label: 'Timer', icon: '⏱', Component: Timer },
  { id: 'manual', label: 'Manual', icon: '📖', Component: Manual },
  { id: 'log', label: 'Log', icon: '📝', Component: SessionLog },
  { id: 'chat', label: 'Chat', icon: '💬', Component: Chat },
]

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
    </div>
  )
}
