const MS_PER_DAY = 24 * 60 * 60 * 1000

function localDateString(date, timeZone) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || 'UTC' }).format(date)
  } catch {
    // Invalid/unrecognized IANA timezone string — fall back rather than throw.
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(date)
  }
}

// Decides whether a subscription is "due" for a nudge today.
//
// Logic: frequency_per_week (1-7) implies an ideal spacing of 7/frequency
// days between sends (e.g. 3/week ≈ every 2.33 days, 7/week = daily,
// 1/week = every 7 days). A subscription is due if:
//   - it has never been sent to (last_sent_at is null), or
//   - it hasn't already been sent one TODAY in the subscriber's own local
//     calendar day (the hard "at most once/day" cap — checked first,
//     independent of frequency, using the stored browser timezone), and
//   - at least that many days have elapsed since the last send.
//
// This is intentionally a simple elapsed-time check rather than a fixed
// day-of-week schedule — it self-corrects if a run is missed (the gap is
// just longer, so the next check is still "due") without needing separate
// backfill logic, and it naturally spreads a week's sends out instead of
// clustering them.
export function isDueToday(subscription, now = new Date()) {
  const frequency = Math.min(7, Math.max(1, Math.round(subscription.frequency_per_week) || 3))
  const intervalDays = 7 / frequency

  if (!subscription.last_sent_at) return true

  const lastSent = new Date(subscription.last_sent_at)
  if (Number.isNaN(lastSent.getTime())) return true

  if (localDateString(lastSent, subscription.timezone) === localDateString(now, subscription.timezone)) {
    return false
  }

  const daysSinceLastSent = (now.getTime() - lastSent.getTime()) / MS_PER_DAY
  // Small grace window: a scheduled cron run can fire a few minutes earlier
  // than the previous day's run (ordinary scheduling jitter), which would
  // otherwise land daysSinceLastSent just under a whole-number intervalDays
  // and skip a day. Most visible at frequency=7 (intervalDays=1, i.e. "every
  // day"), where any jitter at all would trip this without the grace window.
  return daysSinceLastSent >= intervalDays - 0.1
}
