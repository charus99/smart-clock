import { theme } from '../../../mini-display-claude-ai-usage/src/render/theme.mjs'
import { dayMonth, hhmm } from '../../../mini-display-claude-ai-usage/src/render/format.mjs'
import { svgToJpeg } from './jpeg.mjs'

const API = 'https://api.binance.com/api/v3'
const SYMBOL = 'BTCUSDT'
const BITCOIN_ORANGE = '#f7931a'
const CHART = { x: 16, y: 142, width: 208, height: 64 }

/** Binance public API (no key): last price, 24h change and a 24h series of 15-minute closes. */
async function fetchBtc() {
  const get = async (path) => {
    const response = await fetch(API + path, { signal: AbortSignal.timeout(10_000) })
    if (!response.ok) throw new Error(`Binance responded ${response.status}`)
    return response.json()
  }
  const [ticker, klines] = await Promise.all([
    get(`/ticker/24hr?symbol=${SYMBOL}`),
    get(`/klines?symbol=${SYMBOL}&interval=15m&limit=96`)
  ])
  const data = {
    price: Number(ticker.lastPrice),
    changePct: Number(ticker.priceChangePercent),
    high: Number(ticker.highPrice),
    low: Number(ticker.lowPrice),
    series: klines.map((k) => Number(k[4]))
  }
  const numbers = [data.price, data.changePct, data.high, data.low, ...data.series]
  if (data.series.length < 2 || !numbers.every(Number.isFinite)) throw new Error('Binance: unexpected response')
  return data
}

function mockBtc() {
  const series = Array.from({ length: 96 }, (_, i) => 80_000 + 900 * Math.sin(i / 12) + i * 8)
  return { price: series.at(-1), changePct: 0.93, high: Math.max(...series), low: Math.min(...series), series }
}

const usd = (n) => '$' + Math.round(n).toLocaleString('en-US')
const kilo = (n) => `${(n / 1000).toFixed(1)}k`

const text = (x, y, size, fill, content, attrs = '') =>
  `<text x="${x}" y="${y}" font-family="${theme.font}" font-size="${size}" fill="${fill}" ${attrs}>${content}</text>`

/** BTC data -> 240x240 SVG, laid out to match the Claude usage card. */
export function btcSvg({ price, changePct, high, low, series }, now) {
  const { size, color } = theme
  const trend = changePct >= 0 ? color.ok : color.high
  const min = Math.min(...series)
  const span = Math.max(...series) - min || 1
  const bottom = CHART.y + CHART.height
  const line = series
    .map((value, i) => {
      const x = CHART.x + (i / (series.length - 1)) * CHART.width
      const y = bottom - ((value - min) / span) * CHART.height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  // Triangles drawn as shapes: the card fonts are not guaranteed to have ▲/▼.
  const arrow = changePct >= 0 ? '16,124 22,114 28,124' : '16,114 22,124 28,114'

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<rect width="${size}" height="${size}" fill="${color.background}"/>
<circle cx="32" cy="26" r="14" fill="${BITCOIN_ORANGE}"/>
${text(32, 32, 17, '#ffffff', 'B', 'font-weight="700" text-anchor="middle"')}
${text(58, 31, 14, BITCOIN_ORANGE, 'BITCOIN', 'font-weight="700" letter-spacing="1.5"')}
${text(224, 31, 11, color.muted, 'BTC/USDT', 'text-anchor="end"')}
<line x1="16" y1="50" x2="224" y2="50" stroke="${color.divider}" stroke-width="1"/>
${text(16, 98, 38, color.title, usd(price), 'font-weight="700"')}
<polygon points="${arrow}" fill="${trend}"/>
${text(34, 124, 15, trend, `${Math.abs(changePct).toFixed(2)}%`, 'font-weight="700"')}
${text(92, 124, 12, color.muted, '24h')}
${text(224, 124, 11, color.muted, `H ${kilo(high)}  L ${kilo(low)}`, 'text-anchor="end"')}
<polygon points="${CHART.x},${bottom} ${line} ${CHART.x + CHART.width},${bottom}" fill="${trend}" fill-opacity="0.15"/>
<polyline points="${line}" fill="none" stroke="${trend}" stroke-width="2" stroke-linejoin="round"/>
${text(16, 232, 11, color.muted, 'Binance')}
${text(224, 232, 11, color.muted, `updated ${dayMonth(now)} ${hhmm(now)}`, 'text-anchor="end"')}
</svg>`
}

export async function buildBtcCard({ mock = false, now = new Date() } = {}) {
  const data = mock ? mockBtc() : await fetchBtc()
  return { jpeg: await svgToJpeg(btcSvg(data, now)), sourceName: mock ? 'mock' : 'api' }
}
