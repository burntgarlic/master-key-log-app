import webpush from 'web-push'
import { supabaseAdmin } from './_lib/supabaseAdmin.js'
import { pickNudge } from './_lib/nudges.js'
import { isDueToday } from './_lib/schedule.js'

const CRON_SECRET = process.env.CRON_SECRET
const VAPID_PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT

function isAuthorized(req) {
  if (!CRON_SECRET) return false
  const authHeader = req.headers.authorization || ''
  if (authHeader === `Bearer ${CRON_SECRET}`) return true
  const querySecret = req.query?.secret
  if (querySecret && querySecret === CRON_SECRET) return true
  return false
}

export default async function handler(req, res) {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  if (!supabaseAdmin) {
    res.status(500).json({ error: 'Server is missing Supabase configuration.' })
    return
  }
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    res.status(500).json({ error: 'Server is missing VAPID configuration.' })
    return
  }

  const { data: subs, error: subsError } = await supabaseAdmin
    .from('push_subscriptions')
    .select('*')
    .eq('enabled', true)

  if (subsError) {
    res.status(500).json({ error: 'Failed to load subscriptions.' })
    return
  }

  const now = new Date()
  const due = (subs || []).filter((sub) => isDueToday(sub, now))

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

  // Per-user progress lookups, deduplicated (a user could in principle have
  // more than one subscription, e.g. two devices).
  const userIds = [...new Set(due.map((sub) => sub.user_id))]
  const progressByUser = new Map()
  if (userIds.length > 0) {
    const { data: progressRows } = await supabaseAdmin
      .from('progress')
      .select('id, data')
      .in('id', userIds)
    for (const row of progressRows || []) {
      progressByUser.set(row.id, row.data?.currentWeek ?? 1)
    }
  }

  let sent = 0
  let disabled = 0
  const failures = []

  await Promise.all(
    due.map(async (sub) => {
      const currentWeek = progressByUser.get(sub.user_id) ?? 1
      const nudge = pickNudge(currentWeek)
      const payload = JSON.stringify({
        title: `Week ${nudge.week} — ${nudge.title}`,
        body: nudge.text,
        icon: '/icons/icon.svg',
        data: { url: `/?week=${nudge.week}` },
      })

      try {
        await webpush.sendNotification(sub.subscription, payload)
        sent++
        await supabaseAdmin
          .from('push_subscriptions')
          .update({ last_sent_at: now.toISOString() })
          .eq('id', sub.id)
      } catch (err) {
        const statusCode = err?.statusCode
        if (statusCode === 404 || statusCode === 410) {
          await supabaseAdmin.from('push_subscriptions').update({ enabled: false }).eq('id', sub.id)
          disabled++
        }
        failures.push({ id: sub.id, statusCode: statusCode || null, message: err?.message || 'unknown error' })
      }
    }),
  )

  res.status(200).json({ checked: subs.length, due: due.length, sent, disabled, failed: failures.length })
}
