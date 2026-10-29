import { readFileSync } from 'node:fs'
import { theme } from './theme.mjs'

const { size, font, color, bar } = theme

const mascot = readFileSync(new URL('../../claude-mascot.png', import.meta.url)).toString('base64')

const escapeXml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c])

const text = (x, y, fontSize, fill, content, attrs = '') =>
  `<text x="${x}" y="${y}" font-family="${font}" font-size="${fontSize}" fill="${fill}" ${attrs}>${escapeXml(content)}</text>`

/** Card model -> 240x240 SVG string. Layout only; no decisions about what to show. */
export function cardSvg(model) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<rect width="${size}" height="${size}" fill="${color.background}"/>
<image href="data:image/png;base64,${mascot}" x="16" y="10" width="32" height="32"/>
${text(58, 31, 14, color.brand, model.title, 'font-weight="700" letter-spacing="1.5"')}
<line x1="16" y1="50" x2="224" y2="50" stroke="${color.divider}" stroke-width="1"/>
${model.rows.map((r, i) => rowSvg(r, 64 + i * 80)).join('\n')}
${text(224, 232, 11, color.muted, model.updated, 'text-anchor="end"')}
</svg>`
}

function rowSvg(r, top) {
  return (
    text(16, top + 14, 13, color.muted, `${r.tag}  ${r.name}`, 'font-weight="600" letter-spacing="1"') +
    text(224, top + 14, 13, color.muted, r.reset, 'text-anchor="end"') +
    text(16, top + 54, 40, r.color, r.pct, 'font-weight="700"') +
    `<rect x="${bar.x}" y="${top + 62}" width="${bar.width}" height="${bar.height}" rx="5" fill="${color.track}"/>` +
    `<rect x="${bar.x}" y="${top + 62}" width="${Math.max(bar.height, bar.width * r.fill)}" height="${bar.height}" rx="5" fill="${r.color}"/>`
  )
}
