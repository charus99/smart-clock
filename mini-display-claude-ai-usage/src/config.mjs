/** Single place that reads .env / process.env, applies defaults and validates. */
export function loadConfig() {
  try {
    process.loadEnvFile()
  } catch {
    // .env optional
  }
  const env = process.env
  const intervalMinutes = Number(env.INTERVAL_MINUTES ?? 5)
  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
    throw new Error(`Bad INTERVAL_MINUTES: ${env.INTERVAL_MINUTES}`)
  }
  return Object.freeze({
    deviceUrl: env.DEVICE_URL ?? 'http://10.255.221.161/photo/upload',
    uploadDir: env.UPLOAD_DIR ?? '/photo/',
    imagePath: env.IMAGE_PATH ?? 'example.png',
    previewPath: env.PREVIEW_PATH ?? 'usage.png', // PNG of what the device shows, rewritten each update
    intervalMinutes
  })
}
