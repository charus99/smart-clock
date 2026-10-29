import { fileURLToPath } from 'node:url'

/** Reads control-panel/.env (optional) + process.env, applies defaults and validates. */
export function loadConfig() {
  try {
    process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)))
  } catch {
    // .env optional
  }
  const env = process.env
  if (!env.CLOCK_HOST) throw new Error('CLOCK_HOST is not set. Copy .env.example to .env and set the clock IP.')
  const port = Number(env.PORT ?? 8787)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error(`Bad PORT: ${env.PORT}`)
  const cardIntervalMinutes = Number(env.CARD_INTERVAL_MINUTES ?? 5)
  if (!Number.isFinite(cardIntervalMinutes) || cardIntervalMinutes <= 0) {
    throw new Error(`Bad CARD_INTERVAL_MINUTES: ${env.CARD_INTERVAL_MINUTES}`)
  }
  return Object.freeze({
    clockHost: env.CLOCK_HOST,
    port,
    // Loopback by default: the panel can change clock settings and has no login.
    bindHost: env.BIND_HOST ?? '127.0.0.1',
    cardIntervalMinutes,
    cardAuto: env.CARD_AUTO === 'true' // start auto-update without a click (uses the Claude token)
  })
}
