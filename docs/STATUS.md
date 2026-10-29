# Status

Last updated: 2026-10-29

## Hardware

- Clock: "Smart Weather Clock" (sold as SD Pro / Smart Clock Pro Ultra), stock
  firmware, on Wi-Fi. Vendor binaries and manual: github.com/JUZIPi-tech/SD_PRO
  (no source code).
- Firmware version on the device: unknown (its pages do not show it).
- USB: not detected by the PC (no COM port, no USB-serial chip). Likely a
  charge-only cable. Not needed for anything below.

## Clock HTTP API (stock firmware, no authentication)

Read from the clock's own `javascript.js` and pages:

| Endpoint | Purpose |
|---|---|
| `GET /config` | All settings as JSON. Includes Wi-Fi password and OpenWeatherMap key in plain text |
| `GET /api/set?key=&value=` | Set one value. Write keys differ from `/config` names: `lcd_brightness`, `time12_24`, `timesync` |
| `GET /api/set?key=theme&value=N` | Switch the current theme now (not in the stock UI; verified working) |
| `/theme/list`, `/theme/toggle?id=&state=`, `/theme/interval?val=` | Themes in the loop (Photo = id 2; interval 0 = no rotation) |
| `/photo/list`, `/photo/toggle?name=&state=`, `/photo/interval?val=`, `/photo/delete?name=` | Photo loop |
| `POST /photo/upload?dir=/photo/` | Upload a photo (replies with a duplicate Content-Length, so it needs a raw socket) |
| `POST /upload`, `POST /update_ota`, `/restart`, `/scanwifi`, `/connect` | Root file upload, firmware update, restart, Wi-Fi |

Security: anyone on the LAN can read the Wi-Fi password and weather key, change
settings, upload files, or flash firmware.

## Done

- `mini-display-claude-ai-usage/`: vendored copy of
  github.com/Datayolk/mini-display-claude-ai-usage (MIT). Renders a 240×240
  Claude Code usage card and uploads it to the clock. Local change: the card's
  footer shows the date as well as the time (`updated 29 Oct 20:44`).
- `control-panel/`: custom settings page on the PC (`npm start`,
  http://127.0.0.1:8787). Themes, photos, display, brightness/night mode,
  colours, city, Claude card preview/upload/auto-update, and
  "show on screen now" / "restore". Confirmed working on the real clock by the
  user on 2026-10-29.
- `control-panel/Smart Clock Panel.cmd`: portable launcher window
  (PowerShell + WinForms) with start/stop, status, open-web and log.
  `CARD_AUTO=true` in `.env` turns card auto-update on at server start.

## Decided

- Keep the stock firmware and control it over its HTTP API. Custom firmware is
  on hold (no source, chip unknown, no USB connection).
- The control panel runs on the PC, bound to 127.0.0.1, and never sends the
  Wi-Fi password or weather key to the browser.
- Wi-Fi, weather key, NTP, OTA, restart and photo delete are left out of the
  panel on purpose.
- Clock default display: Classic theme only, no rotation. The Claude card is
  shown on demand with "show on screen now".

## Outstanding

- Auto-update interval changed in the web page is not saved; after a restart
  it goes back to `.env` values.
- The panel is not started at Windows login (no Task Scheduler entry yet).
- No automated tests.
- `docs/REQUIREMENTS.md` and `docs/TECH-STACK.md` referenced by CLAUDE.md do
  not exist yet.
