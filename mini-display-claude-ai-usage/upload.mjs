import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { loadConfig } from './src/config.mjs'
import { uploadToDevice } from './src/device.mjs'

const config = loadConfig()
const imagePath = process.argv[2] ?? config.imagePath

try {
  const jpeg = await sharp(await readFile(imagePath))
    .resize(240, 240)
    .jpeg({ quality: 95 })
    .toBuffer()
  console.log(`Uploading ${imagePath} as 240x240 JPEG (${(jpeg.length / 1024).toFixed(1)} KB) to ${config.deviceUrl}?dir=${config.uploadDir}`)
  const status = await uploadToDevice(config.deviceUrl, config.uploadDir, jpeg)
  if (status < 200 || status >= 300) throw new Error(`Device responded ${status}`)
  console.log(`Device responded ${status} — done`)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
