import { parseArgs } from 'node:util'
import { loadConfig } from './src/config.mjs'
import { buildCard, pushCard, savePreview } from './src/app.mjs'

const { values } = parseArgs({
  options: {
    preview: { type: 'string' }, // PNG output path (default PREVIEW_PATH); without --upload nothing is sent
    upload: { type: 'boolean', default: false },
    mock: { type: 'boolean', default: false }, // fake usage instead of calling the API
    five: { type: 'string' }, // with --mock: force 5-hour pct, e.g. 95
    seven: { type: 'string' } // with --mock: force 7-day pct
  }
})

try {
  const config = loadConfig()
  const num = (v) => (v === undefined ? undefined : Number(v))
  const { jpeg, sourceName } = await buildCard(config, { mock: values.mock, five: num(values.five), seven: num(values.seven) })
  if (sourceName === 'mock') console.log('Using mock usage')
  const saved = await savePreview(config, jpeg, values.preview ?? config.previewPath)
  if (saved) console.log(`Preview written to ${saved}`)
  if (values.upload) {
    const status = await pushCard(config, jpeg)
    console.log(`Device responded ${status} — done`)
  }
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
