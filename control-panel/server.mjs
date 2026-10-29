import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { loadConfig } from './src/config.mjs'
import { createClock } from './src/clock.mjs'
import { createCardJob } from './src/card-job.mjs'
import { createDisplayPin } from './src/display-pin.mjs'
import { SETTINGS, THEME_INTERVALS, PHOTO_INTERVALS } from './src/settings.mjs'

const STATIC = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/app.css': ['app.css', 'text/css; charset=utf-8']
}
const MAX_BODY_BYTES = 4096

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

let config
try {
  config = loadConfig()
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
const clock = createClock(config.clockHost)
const card = createCardJob({ uploadUrl: clock.uploadUrl, intervalMinutes: config.cardIntervalMinutes })
const pin = createDisplayPin(clock)

const routes = {
  'GET /api/state': async () => {
    const [settings, themes, photos] = await Promise.all([clock.readSettings(), clock.themes(), clock.photos()])
    return { clockHost: clock.host, settings, themes, photos }
  },

  'POST /api/setting': async ({ key, value }) => {
    const setting = Object.hasOwn(SETTINGS, key) ? SETTINGS[key] : null
    if (!setting) throw new HttpError(400, `Unknown setting: ${key}`)
    let encoded
    try {
      encoded = setting.encode(value)
    } catch (error) {
      throw new HttpError(400, `${key}: ${error.message}`)
    }
    await clock.set(setting.deviceKey, encoded)
    return { ok: true }
  },

  'POST /api/city': async ({ city }) => {
    const name = typeof city === 'string' ? city.trim() : ''
    if (!name || name.length > 80) throw new HttpError(400, 'City name is required (max 80 characters)')
    const key = await clock.weatherKey()
    if (!key) throw new HttpError(409, 'The clock has no OpenWeatherMap key set')
    // Same check the stock page does, but server-side so the key never reaches the browser.
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(name)}&appid=${encodeURIComponent(key)}`,
      { signal: AbortSignal.timeout(10_000) }
    )
    if (response.status === 404) throw new HttpError(404, `OpenWeatherMap does not know "${name}"`)
    if (response.status === 401) throw new HttpError(409, 'The clock\'s OpenWeatherMap key is invalid')
    if (!response.ok) throw new HttpError(502, `OpenWeatherMap responded ${response.status}`)
    const found = await response.json()
    await clock.set('city', name)
    return { ok: true, matched: `${found.name}, ${found.sys?.country ?? '?'}` }
  },

  'POST /api/theme': async ({ id, enabled }) => {
    if (!Number.isInteger(id) || id < 0 || id > 6) throw new HttpError(400, 'Theme id must be 0-6')
    if (!enabled) {
      const { themes } = await clock.themes()
      const others = themes.filter((theme) => theme.enabled && theme.id !== id)
      if (others.length === 0) throw new HttpError(409, 'At least one theme must stay enabled')
    }
    await clock.toggleTheme(id, Boolean(enabled))
    return { ok: true }
  },

  'POST /api/theme-interval': async ({ seconds }) => {
    if (!THEME_INTERVALS.includes(seconds)) throw new HttpError(400, `Theme interval must be one of ${THEME_INTERVALS}`)
    await clock.setThemeInterval(seconds)
    return { ok: true }
  },

  'POST /api/photo': async ({ name, enabled }) => {
    const { files } = await clock.photos()
    if (!files.some((file) => file.name === name)) throw new HttpError(404, `No photo named ${name}`)
    await clock.togglePhoto(name, Boolean(enabled))
    return { ok: true }
  },

  'POST /api/photo-interval': async ({ seconds }) => {
    if (!PHOTO_INTERVALS.includes(seconds)) throw new HttpError(400, `Photo interval must be one of ${PHOTO_INTERVALS}`)
    await clock.setPhotoInterval(seconds)
    return { ok: true }
  },

  'GET /api/card': async () => card.status(),

  'POST /api/card/run': async ({ mock = false, push = true }) => {
    const result = await card.run({ mock: Boolean(mock), push: Boolean(push) })
    return { ...card.status(), result }
  },

  'GET /api/display': async () => pin.status(),

  'POST /api/display/show': async () => {
    // Upload fresh data first: if that fails, the display setup is left untouched.
    const result = await card.run({ mock: false, push: true })
    if (!result.ok) throw new HttpError(502, result.error)
    await pin.pin()
    return { display: await pin.status(), card: card.status() }
  },

  'POST /api/display/restore': async () => {
    try {
      await pin.restore()
    } catch (error) {
      if (error.message.startsWith('Nothing to restore')) throw new HttpError(409, error.message)
      throw error
    }
    return { display: await pin.status() }
  },

  'POST /api/card/auto': async ({ enabled, intervalMinutes }) => {
    try {
      card.setAuto(enabled, intervalMinutes)
    } catch (error) {
      throw new HttpError(400, error.message)
    }
    return card.status()
  }
}

async function readJson(req) {
  // Requiring JSON forces a CORS preflight, so other websites open in the browser
  // cannot post to this panel with a plain form or no-cors fetch.
  if (!req.headers['content-type']?.startsWith('application/json')) {
    throw new HttpError(415, 'Content-Type must be application/json')
  }
  const origin = req.headers.origin
  if (origin && origin !== `http://${req.headers.host}`) throw new HttpError(403, 'Cross-origin request refused')
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Request body too large')
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
  } catch {
    throw new HttpError(400, 'Body is not valid JSON')
  }
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' })
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body)
}

const stamp = () => new Date().toLocaleTimeString('en-GB', { hour12: false })

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://panel')
  try {
    if (req.method === 'GET' && Object.hasOwn(STATIC, pathname)) {
      const [file, type] = STATIC[pathname]
      return send(res, 200, await readFile(new URL(`./public/${file}`, import.meta.url)), type)
    }
    if (req.method === 'GET' && pathname === '/api/card/image') {
      const jpeg = card.image()
      return jpeg ? send(res, 200, jpeg, 'image/jpeg') : send(res, 404, { error: 'No card rendered yet' })
    }
    const route = routes[`${req.method} ${pathname}`]
    if (!route) return send(res, 404, { error: 'Not found' })
    const body = req.method === 'POST' ? await readJson(req) : {}
    send(res, 200, await route(body))
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 502
    if (status >= 500) console.error(`[${stamp()}] ${req.method} ${pathname}: ${error.message}`)
    send(res, status, { error: error.message })
  }
})

server.listen(config.port, config.bindHost, () => {
  console.log(`Smart Clock panel: http://${config.bindHost === '0.0.0.0' ? 'localhost' : config.bindHost}:${config.port}`)
  console.log(`Clock: ${config.clockHost}. Ctrl+C to stop.`)
})
