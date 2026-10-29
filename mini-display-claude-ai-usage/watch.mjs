import { parseArgs } from 'node:util'
import { loadConfig } from './src/config.mjs'
import { buildCard, pushCard, savePreview } from './src/app.mjs'

const { values } = parseArgs({ options: { mock: { type: 'boolean', default: false } } })

let config
try {
  config = loadConfig()
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
const minutes = config.intervalMinutes

const stamp = () => new Date().toLocaleTimeString('en-GB', { hour12: false })
let timer
let stopping = false

async function tick() {
  try {
    const { jpeg, sourceName } = await buildCard(config, { mock: values.mock })
    await savePreview(config, jpeg)
    const status = await pushCard(config, jpeg)
    console.log(`[${stamp()}] uploaded ${(jpeg.length / 1024).toFixed(1)} KB (${sourceName}), device ${status}`)
  } catch (error) {
    // Keep running: Wi-Fi/device hiccups should not kill the loop.
    console.error(`[${stamp()}] failed: ${error.message}`)
  }
  // Schedule after finishing so slow runs never overlap.
  if (!stopping) timer = setTimeout(tick, minutes * 60_000)
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopping = true
    clearTimeout(timer)
    console.log(`\n[${stamp()}] stopped`)
    process.exit(0)
  })
}

console.log(`Updating every ${minutes} min. Ctrl+C to stop.`)
tick()
