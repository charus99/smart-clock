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
| `CARD_AUTO` | `true` turns Claude card auto-update on when the server starts | `false` |
| `BTC_INTERVAL_MINUTES` | Initial auto-update interval for the BTC card | `1` |
| `BTC_AUTO` | `true` turns BTC card auto-update on when the server starts | `false` |

## What it can change

Themes in the loop and their interval, photos in the loop and their interval,
°C / 12-hour / Mile / time sync, date format, GIF, brightness, night mode,
the three clock colours, and the city (checked against OpenWeatherMap first).

Cards (each a 240×240 JPEG in the clock's `/photo/`):

| Card | File | Data |
|---|---|---|
| Claude Usage | `claude_usage.jpg` | Claude Code 5-hour and weekly usage (`mini-display-claude-ai-usage`) |
| Bitcoin | `btc_price.jpg` | BTC/USDT price, 24h change, 24h chart of 15-minute closes, from Binance's public API (no key) |

**โชว์บนจอทันที** (show on screen now) uploads fresh copies of the cards ticked
"โชว์บนจอ", then pins them: only the Photo theme on, theme rotation off, only
those card photos enabled (they alternate at the photo interval), and the
current theme switched to Photo. If one card fails, the others are still shown.

With **รวมหน้านาฬิกาในรอบ** (include the clock face) ticked, the clock face(s)
that were on before pinning (Classic if none) stay enabled next to Photo, and
the theme interval is set to the chosen time, so the screen alternates clock
face ↔ cards. The clock times theme switches and photo switches separately, so
the cards page should last at least cards × photo interval; the page warns
when it does not. The previous
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
- Every auto-update rewrites the card file in the clock's flash storage. Short
  intervals (1 minute) mean many more flash writes; how well the firmware
  spreads them (wear levelling) is unknown.
- Switching the current theme uses `/api/set?key=theme`, which the stock page's
  script supports but its UI never calls. Verified that the clock accepts it and
  `/config` reflects the change; not verified what the screen does.
