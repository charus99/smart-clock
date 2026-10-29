import { theme } from './theme.mjs'
import { dayMonth, hhmm, resetText } from './format.mjs'
import { usageLevel } from '../domain/usage-level.mjs'

/** Pure: usage + now -> what the card shows (no pixels, no SVG). */
export function buildCardModel({ fiveHour, sevenDay }, now) {
  return {
    title: 'CLAUDE CODE',
    rows: [row('5H', 'Session', fiveHour, now), row('7D', 'Weekly', sevenDay, now)],
    updated: `updated ${dayMonth(now)} ${hhmm(now)}`
  }
}

function row(tag, name, { pct, resetsAt }, now) {
  const clamped = Math.min(100, Math.max(0, pct))
  return {
    tag,
    name,
    pct: `${Math.round(clamped)}%`,
    fill: clamped / 100,
    color: theme.color[usageLevel(clamped, theme.level)],
    reset: resetText(resetsAt, now)
  }
}
