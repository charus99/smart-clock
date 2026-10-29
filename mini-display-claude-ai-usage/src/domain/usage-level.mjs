/** Pure. pct -> 'ok' | 'warn' | 'high' using thresholds { warn, high }. */
export function usageLevel(pct, { warn, high }) {
  if (pct >= high) return 'high'
  if (pct >= warn) return 'warn'
  return 'ok'
}
