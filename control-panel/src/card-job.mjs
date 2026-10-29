/**
 * Builds and uploads one card, on demand or on a timer.
 * build({ mock }) -> { jpeg, sourceName }; upload(jpeg) throws on failure.
 * Runs are queued so a manual click never overlaps a timed upload.
 */
export function createCardJob({ build, upload, intervalMinutes }) {
  let auto = false
  let minutes = intervalMinutes
  let timer = null
  let nextRunAt = null
  let lastRun = null
  let lastJpeg = null
  let queue = Promise.resolve()

  async function execute({ mock, push }) {
    const at = new Date().toISOString()
    try {
      const { jpeg, sourceName } = await build({ mock })
      lastJpeg = jpeg
      if (push) await upload(jpeg)
      lastRun = { at, ok: true, source: sourceName, pushed: push }
    } catch (error) {
      lastRun = { at, ok: false, pushed: false, error: error.message }
    }
    return lastRun
  }

  function run({ mock = false, push = true } = {}) {
    const result = queue.then(() => execute({ mock, push }))
    queue = result
    return result
  }

  function schedule() {
    clearTimeout(timer)
    timer = null
    nextRunAt = null
    if (!auto) return
    timer = setTimeout(tick, minutes * 60_000)
    nextRunAt = new Date(Date.now() + minutes * 60_000).toISOString()
  }

  async function tick() {
    await run({ mock: false, push: true })
    // Schedule after finishing so slow runs never overlap.
    schedule()
  }

  return {
    status: () => ({ auto, intervalMinutes: minutes, nextRunAt, lastRun, hasImage: lastJpeg !== null }),
    image: () => lastJpeg,
    run,
    setAuto(enabled, newMinutes) {
      if (newMinutes !== undefined) {
        const n = Number(newMinutes)
        if (!Number.isFinite(n) || n < 1 || n > 1440) throw new RangeError('intervalMinutes must be 1-1440')
        minutes = n
      }
      auto = Boolean(enabled)
      if (auto) tick()
      else schedule()
    }
  }
}
