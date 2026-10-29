const HOUR = 3_600_000

/** Fake usage, same shape as fetchUsage(). */
export function mockUsage(now = new Date(), { five = 42, seven = 18 } = {}) {
  return {
    fiveHour: { pct: five, resetsAt: new Date(now.getTime() + 2.2 * HOUR) },
    sevenDay: { pct: seven, resetsAt: new Date(now.getTime() + 52 * HOUR) }
  }
}
