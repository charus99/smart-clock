# AGENTS.md

Node.js scripts that render **Claude Code usage** (5h + 7d windows) as a 240×240 image and upload it to a GeekMagic display. Based on `../` (calendar). Same architecture: `src/config.mjs` (only env reader), `src/sources/` (I/O), `src/domain/` + `src/render/card-model.mjs` (pure), `src/render/theme.mjs` (look), `src/device.mjs` (raw TCP upload, do not simplify).

## Rules
- The OAuth token is a secret: never print, log, commit or write it anywhere. It is read at runtime from Keychain / `~/.claude/.credentials.json`.
- `usage:upload` and `watch` change the physical display: run only when asked. Prefer `npm run usage` (preview `usage.png`).
- `/api/oauth/usage` is undocumented; keep all parsing in `src/sources/usage.mjs`.
- Verify visual changes with `npm run usage -- --mock --five N --seven N` and look at `usage.png`.
- Update `CHANGELOG.md` for every behavior change.
