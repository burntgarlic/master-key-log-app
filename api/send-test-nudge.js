import webpush from 'web-push'
import { supabaseAdmin, getUserFromRequest } from './_lib/supabaseAdmin.js'
import { pickNudge } from './_lib/nudges.js'

const VAPID_PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
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

  const user = await getUserFromRequest(req)
  if (!user) {
    res.status(401).json({ error: 'Missing or invalid session.' })
    return
  }

  const { data: subs, error: subsError } = await supabaseAdmin
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .eq('enabled', true)

  if (subsError) {
    res.status(500).json({ error: 'Failed to load subscriptions.' })
    return
  }
  if (!subs || subs.length === 0) {
    res.status(400).json({ error: 'No active push subscription for this account.' })
    return
  }

  const { data: progressRow } = await supabaseAdmin
    .from('progress')
    .select('data')
    .eq('id', user.id)
    .maybeSingle()
  const currentWeek = progressRow?.data?.currentWeek ?? 1

  const nudge = pickNudge(currentWeek)
  const payload = JSON.stringify({
    title: `Week ${nudge.week} — ${nudge.title}`,
    body: nudge.text,
    icon: '/icons/icon.svg',
    data: { url: `/?week=${nudge.week}` },
  })

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

  const results = await Promise.allSettled(
    subs.map((sub) => webpush.sendNotification(sub.subscription, payload)),
  )

  let sent = 0
  const failures = []
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'fulfilled') {
      sent++
      continue
    }
    const err = results[i].reason
    const statusCode = err?.statusCode
    if (statusCode === 404 || statusCode === 410) {
      await supabaseAdmin.from('push_subscriptions').update({ enabled: false }).eq('id', subs[i].id)
    }
    failures.push({ statusCode: statusCode || null, message: err?.message || 'unknown error' })
  }

  res.status(200).json({ sent, failed: failures.length, failures, nudge })
}
