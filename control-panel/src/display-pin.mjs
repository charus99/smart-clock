import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const CLASSIC_THEME_ID = 0
const PHOTO_THEME_ID = 2
const NO_ROTATION = 0

const SNAPSHOT_PATH = fileURLToPath(new URL('../.state/display-snapshot.json', import.meta.url))

/**
 * Pins card photos on screen (Photo theme only, no theme rotation, only those photos,
 * which then alternate at the photo interval) and restores the previous display setup.
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

    /**
     * Call after the cards have been uploaded. `cardFiles`: photo names to keep on screen.
     * With `clockSeconds`, the user's usual clock face stays in the loop too: the clock
     * switches between it and the Photo theme every `clockSeconds`.
     */
    async pin(cardFiles, { clockSeconds = null } = {}) {
      const { files } = await clock.photos()
      const missing = cardFiles.filter((name) => !files.some((file) => file.name === name))
      if (missing.length) throw new Error(`Not on the clock yet: ${missing.join(', ')}`)

      // Pressing twice must not overwrite the original setup with the pinned one.
      let snapshot = await readSnapshot()
      if (!snapshot) {
        snapshot = await takeSnapshot()
        await mkdir(fileURLToPath(new URL('../.state/', import.meta.url)), { recursive: true })
        await writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2))
      }

      // "Usual clock face" = the non-Photo themes that were on before pinning (Classic if none).
      const usualFaces = snapshot.themes.filter((t) => t.enabled && t.id !== PHOTO_THEME_ID).map((t) => t.id)
      const clockFaces = clockSeconds ? (usualFaces.length ? usualFaces : [CLASSIC_THEME_ID]) : []
      const { themes } = await clock.themes()
      await applyThemes(themes.map(({ id }) => ({ id, enabled: id === PHOTO_THEME_ID || clockFaces.includes(id) })))
      await clock.setThemeInterval(clockSeconds ?? NO_ROTATION)
      // Enable the cards before disabling the rest, so the photo loop is never empty.
      await applyPhotos(cardFiles.map((name) => ({ name, enabled: true })))
      await applyPhotos(files.filter((f) => !cardFiles.includes(f.name)).map(({ name }) => ({ name, enabled: false })))
      await clock.set('theme', String(PHOTO_THEME_ID))
    },

    async restore() {
      const snapshot = await readSnapshot()
      if (!snapshot) throw new Error('Nothing to restore: the card is not pinned')
      await applyThemes(snapshot.themes)
      await clock.setThemeInterval(snapshot.themeInterval)
      await applyPhotos(snapshot.photos)
      // Cards first uploaded while pinned did not exist before: leave them out of the loop.
      const { files } = await clock.photos()
      const added = files.filter((f) => !snapshot.photos.some((p) => p.name === f.name))
      await applyPhotos(added.map(({ name }) => ({ name, enabled: false })))
      await clock.set('theme', String(snapshot.theme))
      await rm(SNAPSHOT_PATH)
    }
  }
}
