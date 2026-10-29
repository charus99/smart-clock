export const hhmm = (date) => date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })

export const dayMonth = (date) => date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

export const headerDate =(date) => date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()

/** "in 25 min", "in 1h 20m", "now". */
export function countdown(ms) {
  const min = Math.max(0, Math.round(ms / 60_000))
  if (min < 1) return 'now'
  if (min < 60) return `in ${min} min`
  const h = Math.floor(min / 60)
  return min % 60 ? `in ${h}h ${min % 60}m` : `in ${h}h`
}

/** Greedy word wrap; last line gets an ellipsis when text is cut. */
export function wrap(text, maxChars, maxLines) {
  const lines = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    if (line && (line + ' ' + word).length > maxChars) {
      lines.push(line)
      line = word
    } else line = line ? `${line} ${word}` : word
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    lines.length = maxLines
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, maxChars - 1).trimEnd() + '…'
  }
  return lines
}

export const truncate = (text, maxChars) => wrap(text, maxChars, 1)[0]

/** "resets in 2h 10m", "resets in 35m", or "resets Tue 09:00" when over a day away. */
export function resetText(resetsAt, now) {
  const ms = resetsAt - now
  if (ms <= 0) return 'resetting now'
  const min = Math.round(ms / 60_000)
  if (min >= 24 * 60) {
    const day = resetsAt.toLocaleDateString('en-GB', { weekday: 'short' })
    return `resets ${day} ${hhmm(resetsAt)}`
  }
  if (min < 60) return `resets in ${min}m`
  return min % 60 ? `resets in ${Math.floor(min / 60)}h ${min % 60}m` : `resets in ${Math.floor(min / 60)}h`
}
