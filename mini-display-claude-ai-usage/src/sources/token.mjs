import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** Claude Code OAuth access token. macOS Keychain, else ~/.claude/.credentials.json. Secret: never log. */
export async function readClaudeToken() {
  let raw
  if (process.platform === 'darwin') {
    try {
      raw = (await run('security', ['find-generic-password', '-s', 'Claude Code-credentials', '-w'])).stdout
    } catch {
      // fall through to the credentials file
    }
  }
  if (!raw) {
    try {
      raw = await readFile(join(homedir(), '.claude', '.credentials.json'), 'utf8')
    } catch {
      throw new Error('Claude Code login not found. Run `claude` and log in.')
    }
  }
  const token = JSON.parse(raw)?.claudeAiOauth?.accessToken
  if (!token) throw new Error('No OAuth token in Claude Code credentials. Run `claude` and log in.')
  return token
}
