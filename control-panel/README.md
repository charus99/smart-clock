# Smart Clock Control Panel

A custom settings page for the Smart Weather Clock (stock firmware). It runs on
the PC, talks to the clock over its existing HTTP API, and also builds and
uploads the Claude Code usage card using `../mini-display-claude-ai-usage`.

No firmware is flashed or changed.

## Run

Requires Node.js 22+ and `npm ci` already run in `../mini-display-claude-ai-usage`
(the card renderer uses its `sharp` install). The panel itself has no dependencies.

```
cp .env.example .env    # set CLOCK_HOST to the clock's IP
npm start               # open http://127.0.0.1:8787
```

Or double-click **`Smart Clock Panel.cmd`**: a small window with start/stop
buttons, server status, the card's last update, a button to open the web page,
and the server log (`.state/server.log`). It uses only Windows PowerShell 5.1,
so the whole folder can be copied elsewhere. The server keeps running in the
background if you close the window and answer "No" (ไม่) to stopping it. Stop
only kills the process on `PORT` when it is this panel's `node server.mjs`.

| Variable | Purpose | Default |
|---|---|---|
| `CLOCK_HOST` | Clock IP or hostname | required |
| `PORT` | Panel port | `8787` |
| `BIND_HOST` | Interface to listen on | `127.0.0.1` |
| `CARD_INTERVAL_MINUTES` | Initial auto-update interval for the usage card | `5` |
| `CARD_AUTO` | `true` turns card auto-update on when the server starts | `false` |

## What it can change

Themes in the loop and their interval, photos in the loop and their interval,
°C / 12-hour / Mile / time sync, date format, GIF, brightness, night mode,
the three clock colours, and the city (checked against OpenWeatherMap first).

**โชว์บนจอทันที** (show on screen now) uploads a fresh card with real usage data,
then pins it: only the Photo theme on, theme rotation off, only
`claude_usage.jpg` enabled, and the current theme switched to Photo. The previous
themes, theme interval, photo toggles and current theme are saved to
`.state/display-snapshot.json` first. **กลับเป็นแบบเดิม** (restore) puts them back
and deletes the snapshot. If the upload fails, nothing on the clock is changed.

Not included on purpose: Wi-Fi, OpenWeatherMap key, NTP server, OTA firmware
update, restart, and deleting photos. Use the clock's own page for those.

## Security notes

- The clock's own API has no authentication and returns the Wi-Fi password and
  weather key from `/config`. The panel strips both before anything reaches the
  browser, but anyone on the LAN can still read them from the clock directly.
- The panel has no login, so it listens on `127.0.0.1` only. Setting
  `BIND_HOST=0.0.0.0` lets phones on the LAN use it, and also lets anyone on the
  LAN change clock settings through it.
- POST requests must be `application/json` and same-origin, so other websites
  open in the browser cannot change settings through the panel.
- "ส่งข้อมูลจริง" and auto-update read the Claude Code OAuth token from
  `~/.claude/.credentials.json` and send it only to `api.anthropic.com`
  (see `mini-display-claude-ai-usage/src/sources/`). That usage endpoint is
  undocumented and may change.

## Limits

- Auto-update state lives in memory: after a restart it goes back to `CARD_AUTO`.
- The card only shows on the clock when the Photo theme is enabled.
- A pinned card is a still image: turn on auto-update to keep the numbers fresh.
- Switching the current theme uses `/api/set?key=theme`, which the stock page's
  script supports but its UI never calls. Verified that the clock accepts it and
  `/config` reflects the change; not verified what the screen does.
