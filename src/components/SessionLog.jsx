import { getPendingSessionMinutes } from '../lib/storage.js'

export default function SessionLog() {
  const pendingMinutes = getPendingSessionMinutes()

  return (
    <div className="placeholder-screen">
      <h1>Session Log</h1>
      <p>Daily logging and the 7-tick week tracker coming soon.</p>
      {pendingMinutes && (
        <p>Pending from Timer: {pendingMinutes} min, ready to pre-fill once logging is built.</p>
      )}
    </div>
  )
}
