import { rename, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { fetchUsage } from './sources/usage.mjs'
import { mockUsage } from './sources/mock.mjs'
import { renderCard } from './render/index.mjs'
import { uploadToDevice } from './device.mjs'

/** Builds the Claude Code usage card as JPEG. Mock data when mock=true (optionally forced pct). */
export async function buildCard(config, { now = new Date(), mock = false, five, seven } = {}) {
  const usage = mock ? mockUsage(now, { five, seven }) : await fetchUsage()
  return { jpeg: await renderCard(usage, now), sourceName: mock ? 'mock' : 'api' }
}

/** Uploads a JPEG to the device. Returns the HTTP status. */
export async function pushCard(config, jpeg) {
  const status = await uploadToDevice(config.deviceUrl, config.uploadDir, jpeg)
  if (status < 200 || status >= 300) throw new Error(`Device responded ${status}`)
  return status
}

/**
 * Writes the exact image the device receives as a PNG, replacing the previous one.
 * Returns the path, or null when disabled (PREVIEW_PATH='').
 */
export async function savePreview(config, jpeg, path = config.previewPath) {
  if (!path) return null
  const tmp = `${path}.tmp`
  await writeFile(tmp, await sharp(jpeg).png().toBuffer())
  await rename(tmp, path) // atomic: viewers never see a half-written file
  return path
}
