import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const PHOTO_THEME_ID = 2
const NO_ROTATION = 0
// File name the mini-display uploader always writes (mini-display-claude-ai-usage/src/device.mjs).
export const CARD_FILE = 'claude_usage.jpg'

const SNAPSHOT_PATH = fileURLToPath(new URL('../.state/display-snapshot.json', import.meta.url))

/**
 * Pins the Claude card on screen (Photo theme only, no rotation, only the card photo)
 * and restores the previous display setup afterwards.
 * The snapshot is kept on disk so "restore" still works after the panel restarts.
 */
export function createDisplayPin(clock) {
  async function readSnapshot() {
    try {
      return JSON.parse(await readFile(SNAPSHOT_PATH, 'utf8'))
    } catch (error) {
      if (error.code === 'ENOENT') return null
      throw new Error(`Cannot read display snapshot: ${error.message}`)
    }
  }

  async function takeSnapshot() {
    const [settings, themes, photos] = await Promise.all([clock.readSettings(), clock.themes(), clock.photos()])
    return {
      takenAt: new Date().toISOString(),
      theme: settings.theme,
      themeInterval: themes.interval,
      themes: themes.themes.map(({ id, enabled }) => ({ id, enabled })),
      photos: photos.files.map(({ name, enabled }) => ({ name, enabled }))
    }
  }

  /** Enables `wanted` first, then disables the rest, so the clock never has zero themes on. */
  async function applyThemes(themes) {
    const current = (await clock.themes()).themes
    const isOn = (id) => current.find((theme) => theme.id === id)?.enabled
    for (const { id } of themes.filter((t) => t.enabled && !isOn(t.id))) await clock.toggleTheme(id, true)
    for (const { id } of themes.filter((t) => !t.enabled && isOn(t.id))) await clock.toggleTheme(id, false)
  }

  async function applyPhotos(photos) {
    const current = (await clock.photos()).files
    for (const { name, enabled } of photos) {
      const file = current.find((f) => f.name === name)
      if (file && file.enabled !== enabled) await clock.togglePhoto(name, enabled)
    }
  }

  return {
    async status() {
      const snapshot = await readSnapshot()
      return { pinned: snapshot !== null, since: snapshot?.takenAt ?? null }
    },

    /** Call after the card has been uploaded. */
    async pin() {
      const { files } = await clock.photos()
      if (!files.some((file) => file.name === CARD_FILE)) throw new Error(`${CARD_FILE} is not on the clock yet`)

      // Pressing twice must not overwrite the original setup with the pinned one.
      if (!(await readSnapshot())) {
        await mkdir(fileURLToPath(new URL('../.state/', import.meta.url)), { recursive: true })
        await writeFile(SNAPSHOT_PATH, JSON.stringify(await takeSnapshot(), null, 2))
      }

      const { themes } = await clock.themes()
      await applyThemes(themes.map(({ id }) => ({ id, enabled: id === PHOTO_THEME_ID })))
      await clock.setThemeInterval(NO_ROTATION)
      await applyPhotos(files.map(({ name }) => ({ name, enabled: name === CARD_FILE })))
      await clock.set('theme', String(PHOTO_THEME_ID))
    },

    async restore() {
      const snapshot = await readSnapshot()
      if (!snapshot) throw new Error('Nothing to restore: the card is not pinned')
      await applyThemes(snapshot.themes)
      await clock.setThemeInterval(snapshot.themeInterval)
      await applyPhotos(snapshot.photos)
      await clock.set('theme', String(snapshot.theme))
      await rm(SNAPSHOT_PATH)
    }
  }
}
