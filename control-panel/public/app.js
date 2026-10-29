const CARD_IDS = ['claude', 'btc']
const CARD_NAMES = { claude: 'Claude', btc: 'BTC' }
const CARD_POLL_MS = 30_000
const INCLUDE_KEY = 'smart-clock-panel:show-cards'

const $ = (selector) => document.querySelector(selector)
const $$ = (selector) => [...document.querySelectorAll(selector)]

async function api(path, body) {
  const options = body === undefined
    ? {}
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  const response = await fetch(path, options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`)
  return data
}

let toastTimer
function toast(message, isError = false) {
  const el = $('#toast')
  el.textContent = message
  el.classList.toggle('error', isError)
  el.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.remove('show'), isError ? 5000 : 2000)
}

/** Sends a change; on failure shows why and reloads so the UI matches the clock again. */
async function save(path, body, okMessage = 'บันทึกแล้ว') {
  try {
    const result = await api(path, body)
    toast(okMessage)
    return result
  } catch (error) {
    toast(error.message, true)
    await loadState()
    return null
  }
}

// --- colour helpers (the clock stores RGB565) ---
function hexToRgb565(hex) {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)
}

function rgb565ToHex(value) {
  const r = Math.round((((value >> 11) & 0x1f) * 255) / 31)
  const g = Math.round((((value >> 5) & 0x3f) * 255) / 63)
  const b = Math.round(((value & 0x1f) * 255) / 31)
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

const formatTime = (iso) => new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })

// --- state rendering ---
function renderSettings(settings) {
  for (const el of $$('[data-setting]')) {
    const value = settings[el.dataset.setting]
    if (value === undefined) continue
    if (el.type === 'checkbox') el.checked = value === true || Number(value) === 1
    else el.value = String(value)
    const output = $(`output[data-for="${el.dataset.setting}"]`)
    if (output) output.textContent = el.value
  }
  for (const el of $$('[data-color]')) {
    const value = settings[el.dataset.color]
    if (typeof value === 'number') el.value = rgb565ToHex(value)
  }
  $('#city').value = settings.city ?? ''
}

function checkItem({ label, checked, extra, onChange }) {
  const li = document.createElement('li')
  const wrapper = document.createElement('label')
  const box = document.createElement('input')
  box.type = 'checkbox'
  box.checked = checked
  box.addEventListener('change', () => onChange(box.checked))
  const name = document.createElement('span')
  name.textContent = label // names come from the clock: never inject as HTML
  wrapper.append(box, name)
  if (extra) {
    const size = document.createElement('span')
    size.className = 'size'
    size.textContent = extra
    wrapper.append(size)
  }
  li.append(wrapper)
  return li
}

function renderThemes({ interval, themes }) {
  $('#themes').replaceChildren(...themes.map((theme) => checkItem({
    label: theme.name,
    checked: theme.enabled,
    onChange: async (enabled) => {
      await save('/api/theme', { id: theme.id, enabled }, `${theme.name}: ${enabled ? 'เปิด' : 'ปิด'}`)
      await loadState()
    }
  })))
  $('#theme-interval').value = String(interval)
}

function renderPhotos({ files, total, used, interval }) {
  $('#photos').replaceChildren(...files.map((file) => checkItem({
    label: file.name,
    checked: file.enabled,
    extra: formatBytes(file.size),
    onChange: (enabled) => save('/api/photo', { name: file.name, enabled }, `${file.name}: ${enabled ? 'เปิด' : 'ปิด'}`)
  })))
  // Same clock setting shown in two places (photos, and cards on screen).
  $$('[data-photo-interval]').forEach((el) => (el.value = String(interval)))
  const percent = total ? Math.round((used / total) * 100) : 0
  $('#storage-bar').style.width = `${percent}%`
  $('#storage-text').textContent = `ใช้ไป ${formatBytes(used)} จาก ${formatBytes(total)} (เหลือ ${formatBytes(total - used)})`
}

async function loadState() {
  const pill = $('#connection')
  try {
    const { clockHost, settings, themes, photos } = await api('/api/state')
    renderSettings(settings)
    renderThemes(themes)
    renderPhotos(photos)
    pill.textContent = `เชื่อมต่อ ${clockHost}`
    pill.className = 'pill ok'
  } catch (error) {
    pill.textContent = 'ติดต่อนาฬิกาไม่ได้'
    pill.className = 'pill bad'
    toast(error.message, true)
  }
}

// --- cards (Claude usage, BTC price) ---
const part = (id, role) => document.querySelector(`[data-card="${id}"] [data-role="${role}"]`)
const cardButtons = () => [...$$('[data-card] button'), $('#display-show'), $('#display-restore')]
const shownRunAt = {}

function renderCard(id, status) {
  part(id, 'auto').checked = status.auto
  part(id, 'interval').value = String(status.intervalMinutes)
  const run = status.lastRun
  let text = 'ยังไม่เคยส่ง'
  if (run) {
    const what = run.ok
      ? `${run.pushed ? 'ส่งขึ้นนาฬิกาแล้ว' : 'สร้างตัวอย่างแล้ว'} (${run.source === 'mock' ? 'ข้อมูลจำลอง' : 'ข้อมูลจริง'})`
      : `ล้มเหลว: ${run.error}`
    text = `${formatTime(run.at)} · ${what}`
  }
  if (status.auto && status.nextRunAt) text += ` · รอบถัดไป ${formatTime(status.nextRunAt)}`
  part(id, 'status').textContent = text
  part(id, 'status').classList.toggle('warn', Boolean(run && !run.ok))
  if (status.hasImage && run?.at !== shownRunAt[id]) {
    shownRunAt[id] = run?.at ?? null
    const img = part(id, 'image')
    img.src = `/api/cards/image?card=${id}&t=${Date.now()}`
    img.hidden = false
    part(id, 'empty').hidden = true
  }
}

const renderCards = (statuses) => CARD_IDS.forEach((id) => statuses[id] && renderCard(id, statuses[id]))

/** Disables every card button while one action runs, so clicks never overlap. */
async function busy(button, action) {
  const buttons = cardButtons()
  buttons.forEach((b) => (b.disabled = true))
  const original = button.textContent
  button.textContent = 'กำลังทำ…'
  try {
    await action()
  } catch (error) {
    toast(error.message, true)
  } finally {
    button.textContent = original
    buttons.forEach((b) => (b.disabled = false))
  }
}

function runCard(id, button, body) {
  return busy(button, async () => {
    const status = await api('/api/cards/run', { card: id, ...body })
    renderCard(id, status)
    if (status.result.ok) toast(body.push ? `ส่งการ์ด ${CARD_NAMES[id]} ขึ้นนาฬิกาแล้ว` : 'สร้างตัวอย่างแล้ว')
    else toast(status.result.error, true)
  })
}

async function setCardAuto(id) {
  try {
    renderCard(id, await api('/api/cards/auto', {
      card: id,
      enabled: part(id, 'auto').checked,
      intervalMinutes: Number(part(id, 'interval').value)
    }))
    toast(`${CARD_NAMES[id]}: ${part(id, 'auto').checked ? 'เปิด' : 'ปิด'}อัปเดตอัตโนมัติ`)
  } catch (error) {
    toast(error.message, true)
  }
}

// Which cards "show now" includes: a per-browser preference, so localStorage is enough.
function loadIncluded() {
  try {
    const saved = JSON.parse(localStorage.getItem(INCLUDE_KEY))
    if (Array.isArray(saved)) CARD_IDS.forEach((id) => (part(id, 'include').checked = saved.includes(id)))
  } catch {
    // storage blocked or corrupt: keep the defaults (all checked)
  }
}

const includedCards = () => CARD_IDS.filter((id) => part(id, 'include').checked)

function saveIncluded() {
  try {
    localStorage.setItem(INCLUDE_KEY, JSON.stringify(includedCards()))
  } catch {
    // not critical
  }
}

// --- pin cards on screen ---
function renderDisplay({ pinned, since }) {
  $('#display-restore').hidden = !pinned
  $('#display-show').textContent = pinned ? 'อัปเดตการ์ดบนจอ' : 'โชว์บนจอทันที'
  const status = $('#display-status')
  status.hidden = !pinned
  const anyAuto = CARD_IDS.some((id) => part(id, 'auto').checked)
  status.textContent = pinned
    ? `ล็อกการ์ดไว้บนจอตั้งแต่ ${formatTime(since)} · ธีม/รูปอื่นปิดชั่วคราว${anyAuto ? '' : ' · เปิด “อัปเดตอัตโนมัติ” เพื่อให้ตัวเลขสด'}`
    : ''
}

function showOnScreen(button) {
  const cards = includedCards()
  if (cards.length === 0) return toast('เลือกการ์ดที่จะโชว์อย่างน้อย 1 ใบ', true)
  return busy(button, async () => {
    try {
      const result = await api('/api/display/show', { cards })
      renderCards(result.cards)
      renderDisplay(result.display)
      if (result.failed.length) {
        toast(`ขึ้นจอแล้ว ยกเว้น ${result.failed.map((f) => `${CARD_NAMES[f.id]} (${f.error})`).join(', ')}`, true)
      } else toast('การ์ดขึ้นจอแล้ว')
    } finally {
      await loadState()
    }
  })
}

function restoreScreen(button) {
  return busy(button, async () => {
    try {
      renderDisplay((await api('/api/display/restore', {})).display)
      toast('คืนค่าการแสดงผลเดิมแล้ว')
    } finally {
      await loadState()
    }
  })
}

async function pollCards() {
  try {
    renderCards(await api('/api/cards'))
  } catch {
    // panel server restarting; next poll retries
  }
}

// --- wiring ---
for (const el of $$('[data-setting]')) {
  const key = el.dataset.setting
  if (el.type === 'range') {
    // Send on release only: the clock is slow and dragging would flood it.
    el.addEventListener('input', () => ($(`output[data-for="${key}"]`).textContent = el.value))
  }
  el.addEventListener('change', async () => {
    const value = el.type === 'checkbox' ? el.checked : Number(el.value)
    const ok = await save('/api/setting', { key, value })
    if (ok && key === 'sync' && value) {
      const zone = -new Date().getTimezoneOffset() / 60
      await save('/api/setting', { key: 'zone', value: zone }, `ตั้งโซนเวลา UTC${zone >= 0 ? '+' : ''}${zone}`)
    }
  })
}

for (const el of $$('[data-color]')) {
  el.addEventListener('change', () => save('/api/setting', { key: el.dataset.color, value: hexToRgb565(el.value) }))
}

$('#theme-interval').addEventListener('change', (e) => save('/api/theme-interval', { seconds: Number(e.target.value) }))
for (const el of $$('[data-photo-interval]')) {
  el.addEventListener('change', async () => {
    $$('[data-photo-interval]').forEach((other) => (other.value = el.value))
    await save('/api/photo-interval', { seconds: Number(el.value) }, 'ตั้งเวลาสลับแล้ว')
  })
}

$('#city-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const button = e.submitter
  button.disabled = true
  try {
    const result = await api('/api/city', { city: $('#city').value })
    toast(`บันทึกเมือง: ${result.matched}`)
  } catch (error) {
    toast(error.message, true)
  } finally {
    button.disabled = false
  }
})

for (const id of CARD_IDS) {
  const preview = part(id, 'preview')
  preview.addEventListener('click', () => runCard(id, preview, { mock: preview.dataset.mock === 'true', push: false }))
  part(id, 'push').addEventListener('click', (e) => runCard(id, e.currentTarget, { mock: false, push: true }))
  part(id, 'auto').addEventListener('change', () => setCardAuto(id))
  part(id, 'interval').addEventListener('change', () => {
    if (part(id, 'auto').checked) setCardAuto(id)
  })
  part(id, 'include').addEventListener('change', saveIncluded)
}
$('#display-show').addEventListener('click', (e) => showOnScreen(e.currentTarget))
$('#display-restore').addEventListener('click', (e) => restoreScreen(e.currentTarget))

loadIncluded()
loadState()
pollCards()
api('/api/display').then(renderDisplay).catch((error) => toast(error.message, true))
setInterval(pollCards, CARD_POLL_MS)
