Base mini-display-calendar now I want to show Claud Code Usage on my mini-display

Claude Code OAuth token (best for scripts)

TOKEN=$(security find-generic-password -s "Claude Code-credentials" -w | jq -r '.claudeAiOauth.accessToken')
curl -s https://api.anthropic.com/api/oauth/usage \
  -H "Authorization: Bearer $TOKEN" \
  -H "anthropic-beta: oauth-2025-04-20"
Returns JSON with utilization % and reset times for the 5-hour window and the 7-day window.
Token lives in the macOS Keychain after claude login. On Linux/Windows it’s in ~/.claude/.credentials.json.
Treat the token as a secret. Don’t paste it in chat or commit it.