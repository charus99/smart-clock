const PHOTO_THEME_ID = 2
const CARD_POLL_MS = 30_000

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
  const photoTheme = themes.find((theme) => theme.id === PHOTO_THEME_ID)
  $('#card-photo-warning').hidden = Boolean(photoTheme?.enabled)
}

function renderPhotos({ files, total, used, interval }) {
  $('#photos').replaceChildren(...files.map((file) => checkItem({
    label: file.name,
    checked: file.enabled,
    extra: formatBytes(file.size),
    onChange: (enabled) => save('/api/photo', { name: file.name, enabled }, `${file.name}: ${enabled ? 'เปิด' : 'ปิด'}`)
  })))
  $('#photo-interval').value = String(interval)
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

// --- Claude usage card ---
let shownRunAt = null
function renderCard(status) {
  $('#card-auto').checked = status.auto
  $('#card-interval').value = String(status.intervalMinutes)
  const run = status.lastRun
  let text = 'ยังไม่เคยส่ง'
  if (run) {
    const what = run.ok
      ? `${run.pushed ? 'ส่งขึ้นนาฬิกาแล้ว' : 'สร้างตัวอย่างแล้ว'} (${run.source === 'mock' ? 'ข้อมูลจำลอง' : 'ข้อมูลจริง'})`
      : `ล้มเหลว: ${run.error}`
    text = `${formatTime(run.at)} · ${what}`
  }
  if (status.auto && status.nextRunAt) text += ` · รอบถัดไป ${formatTime(status.nextRunAt)}`
  $('#card-status').textContent = text
  $('#card-status').classList.toggle('warn', Boolean(run && !run.ok))
  if (status.hasImage && run?.at !== shownRunAt) {
    shownRunAt = run?.at ?? null
    const img = $('#card-image')
    img.src = `/api/card/image?t=${Date.now()}`
    img.hidden = false
    $('#card-empty').hidden = true
  }
}

async function runCard(button, body) {
  const buttons = [$('#card-mock'), $('#card-push')]
  buttons.forEach((b) => (b.disabled = true))
  const original = button.textContent
  button.textContent = 'กำลังทำ…'
  try {
    const status = await api('/api/card/run', body)
    renderCard(status)
    if (status.result.ok) toast(body.push ? 'ส่งการ์ดขึ้นนาฬิกาแล้ว' : 'สร้างตัวอย่างแล้ว')
    else toast(status.result.error, true)
  } catch (error) {
    toast(error.message, true)
  } finally {
    button.textContent = original
    buttons.forEach((b) => (b.disabled = false))
  }
}

async function setCardAuto() {
  try {
    renderCard(await api('/api/card/auto', {
      enabled: $('#card-auto').checked,
      intervalMinutes: Number($('#card-interval').value)
    }))
    toast($('#card-auto').checked ? 'เปิดอัปเดตอัตโนมัติ' : 'ปิดอัปเดตอัตโนมัติ')
  } catch (error) {
    toast(error.message, true)
  }
}

// --- pin the card on screen ---
function renderDisplay({ pinned, since }) {
  $('#display-restore').hidden = !pinned
  $('#display-show').textContent = pinned ? 'อัปเดตการ์ดบนจอ' : 'โชว์บนจอทันที'
  const status = $('#display-status')
  status.hidden = !pinned
  status.textContent = pinned
    ? `ล็อกการ์ดไว้บนจอตั้งแต่ ${formatTime(since)} · ธีม/รูปอื่นปิดชั่วคราว${$('#card-auto').checked ? '' : ' · เปิด “อัปเดตอัตโนมัติ” เพื่อให้ตัวเลขสด'}`
    : ''
}

async function displayAction(button, path, okMessage) {
  const buttons = [$('#display-show'), $('#display-restore'), $('#card-mock'), $('#card-push')]
  buttons.forEach((b) => (b.disabled = true))
  const original = button.textContent
  button.textContent = 'กำลังทำ…'
  try {
    const result = await api(path, {})
    if (result.card) renderCard(result.card)
    button.textContent = original
    renderDisplay(result.display)
    toast(okMessage)
  } catch (error) {
    button.textContent = original
    toast(error.message, true)
  } finally {
    buttons.forEach((b) => (b.disabled = false))
    await loadState()
  }
}

async function pollCard() {
  try {
    renderCard(await api('/api/card'))
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
$('#photo-interval').addEventListener('change', (e) => save('/api/photo-interval', { seconds: Number(e.target.value) }))

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

$('#card-mock').addEventListener('click', (e) => runCard(e.currentTarget, { mock: true, push: false }))
$('#card-push').addEventListener('click', (e) => runCard(e.currentTarget, { mock: false, push: true }))
$('#display-show').addEventListener('click', (e) => displayAction(e.currentTarget, '/api/display/show', 'การ์ดขึ้นจอแล้ว'))
$('#display-restore').addEventListener('click', (e) => displayAction(e.currentTarget, '/api/display/restore', 'คืนค่าการแสดงผลเดิมแล้ว'))
$('#card-auto').addEventListener('change', setCardAuto)
$('#card-interval').addEventListener('change', () => {
  if ($('#card-auto').checked) setCardAuto()
})

loadState()
pollCard()
api('/api/display').then(renderDisplay).catch((error) => toast(error.message, true))
setInterval(pollCard, CARD_POLL_MS)
