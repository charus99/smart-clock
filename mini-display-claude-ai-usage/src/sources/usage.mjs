import { readClaudeToken } from './token.mjs'

const URL = 'https://api.anthropic.com/api/oauth/usage'

/** -> { fiveHour: { pct, resetsAt: Date }, sevenDay: { pct, resetsAt: Date } } */
export async function fetchUsage() {
  const response = await fetch(URL, {
    headers: { Authorization: `Bearer ${await readClaudeToken()}`, 'anthropic-beta': 'oauth-2025-04-20' },
    signal: AbortSignal.timeout(15_000)
  })
  if (response.status === 401) throw new Error('Claude token expired (401). Run `claude` to refresh login.')
  if (!response.ok) throw new Error(`Usage API responded ${response.status}`)
  const body = await response.json()
  return { fiveHour: windowOf(body.five_hour, 'five_hour'), sevenDay: windowOf(body.seven_day, 'seven_day') }
}

function windowOf(window, name) {
  if (typeof window?.utilization !== 'number') throw new Error(`Usage API: no ${name}.utilization`)
  return { pct: window.utilization, resetsAt: new Date(window.resets_at) }
}
