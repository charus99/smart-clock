const TIMEOUT_MS = 8_000

/** HTTP client for the stock Smart Weather Clock firmware. */
export function createClock(host) {
  const base = `http://${host}`

  async function get(path) {
    let response
    try {
      response = await fetch(base + path, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    } catch (error) {
      throw new Error(`Clock ${host} unreachable (${error.cause?.code ?? error.name})`)
    }
    // Log the path only: query strings can carry setting values.
    if (!response.ok) throw new Error(`Clock responded ${response.status} for ${path.split('?')[0]}`)
    return response
  }

  async function command(path) {
    await (await get(path)).arrayBuffer() // drain so the socket is released
  }

  async function rawConfig() {
    return (await get('/config')).json()
  }

  return {
    host,
    uploadUrl: `${base}/photo/upload`,

    /**
     * Clock settings without the Wi-Fi password and weather key. The firmware serves both
     * to anyone on the LAN; the panel keeps them on the server side.
     */
    async readSettings() {
      const { password, weatherkey, ...settings } = await rawConfig()
      return { ...settings, hasWeatherKey: Boolean(weatherkey) }
    },
    async weatherKey() {
      return (await rawConfig()).weatherkey || null
    },
    set: (deviceKey, value) => command(`/api/set?key=${deviceKey}&value=${encodeURIComponent(value)}`),

    themes: async () => (await get('/theme/list')).json(),
    toggleTheme: (id, enabled) => command(`/theme/toggle?id=${id}&state=${enabled ? 1 : 0}`),
    setThemeInterval: (seconds) => command(`/theme/interval?val=${seconds}`),

    photos: async () => (await get('/photo/list')).json(),
    togglePhoto: (name, enabled) => command(`/photo/toggle?name=${encodeURIComponent(name)}&state=${enabled ? 1 : 0}`),
    setPhotoInterval: (seconds) => command(`/photo/interval?val=${seconds}`)
  }
}
