# One-time setup for the Smart Clock control panel on a new Windows PC:
# checks Node.js, installs the card renderer's packages, writes control-panel\.env,
# and can add a desktop shortcut. Safe to run again.
# Saved as UTF-8 with BOM so Windows PowerShell 5.1 reads the Thai text.
#
# Parameters exist so it can also run unattended (e.g. -ClockHost 192.168.1.31 -KeepEnv -NoShortcut).

param(
  [string]$ClockHost,
  [ValidateSet('ask', 'yes', 'no')][string]$Auto = 'ask',
  [switch]$KeepEnv,
  [switch]$NoShortcut
)

$ErrorActionPreference = 'Stop'
$PanelDir = Split-Path -Parent $PSScriptRoot
$RepoDir = Split-Path -Parent $PanelDir
$RendererDir = Join-Path $RepoDir 'mini-display-claude-ai-usage'
$EnvFile = Join-Path $PanelDir '.env'
$EnvExample = Join-Path $PanelDir '.env.example'
$MinNodeMajor = 22

function Step([string]$Text) { Write-Host "`n== $Text" -ForegroundColor Cyan }
function Ok([string]$Text) { Write-Host "   OK  $Text" -ForegroundColor Green }
function Warn([string]$Text) { Write-Host "   !!  $Text" -ForegroundColor Yellow }
function Fail([string]$Text) { Write-Host "   XX  $Text" -ForegroundColor Red; exit 1 }

function Ask-YesNo([string]$Question, [bool]$Default) {
  $hint = if ($Default) { '[Y/n]' } else { '[y/N]' }
  $answer = Read-Host "   $Question $hint"
  if ([string]::IsNullOrWhiteSpace($answer)) { return $Default }
  return $answer.Trim().ToLower().StartsWith('y')
}

function Update-PathFromRegistry {
  # winget installs into PATH for new processes only; pick it up in this one too.
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}

function Get-NodeMajor {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { return $null }
  $version = (& $node.Source --version).Trim()   # e.g. v26.13.0
  return [int]($version.TrimStart('v').Split('.')[0])
}

Write-Host 'Smart Clock Panel - ติดตั้ง' -ForegroundColor White

# --- 1. Node.js ---
Step 'Node.js'
Update-PathFromRegistry
$major = Get-NodeMajor
if (-not $major -or $major -lt $MinNodeMajor) {
  if ($major) { Warn "พบ Node.js v$major แต่ต้องใช้ v$MinNodeMajor ขึ้นไป" } else { Warn 'ยังไม่ได้ติดตั้ง Node.js' }
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Fail "ไม่พบ winget กรุณาติดตั้ง Node.js $MinNodeMajor+ เองจาก https://nodejs.org แล้วรันไฟล์นี้อีกครั้ง"
  }
  if (-not (Ask-YesNo 'ติดตั้ง Node.js LTS ด้วย winget เลยไหม' $true)) { Fail 'ยกเลิก: ต้องมี Node.js ก่อน' }
  winget install --id OpenJS.NodeJS.LTS --source winget --exact --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) { Fail "winget ติดตั้งไม่สำเร็จ (exit $LASTEXITCODE)" }
  Update-PathFromRegistry
  $major = Get-NodeMajor
  if (-not $major -or $major -lt $MinNodeMajor) { Fail 'ติดตั้งแล้วแต่ยังหา node ไม่เจอ ลองปิดหน้าต่างแล้วรันไฟล์นี้ใหม่' }
}
Ok "Node.js v$major"

# --- 2. Card renderer packages ---
Step 'ติดตั้งแพ็กเกจสร้างรูปการ์ด (npm ci)'
if (-not (Test-Path (Join-Path $RendererDir 'package-lock.json'))) { Fail "ไม่พบ $RendererDir" }
Push-Location $RendererDir
try {
  & npm.cmd ci --no-fund --no-audit
  # A running panel server keeps sharp's native file open, which blocks npm on Windows.
  if ($LASTEXITCODE -ne 0) { Fail "npm ci ไม่สำเร็จ (exit $LASTEXITCODE) ถ้าเซิร์ฟเวอร์ panel เปิดอยู่ ให้หยุดก่อนแล้วรันใหม่" }
} finally {
  Pop-Location
}
Ok 'ติดตั้งแพ็กเกจแล้ว'

# --- 3. .env ---
Step 'ตั้งค่า (control-panel\.env)'
$writeEnv = $true
if (Test-Path $EnvFile) {
  $writeEnv = if ($KeepEnv) { $false } else { -not (Ask-YesNo 'มีไฟล์ .env อยู่แล้ว ใช้ของเดิมไหม' $true) }
  if (-not $writeEnv) { Ok 'ใช้ .env เดิม' }
}

if ($writeEnv) {
  if (-not $ClockHost) { $ClockHost = (Read-Host '   IP ของนาฬิกา (ดูได้บนจอนาฬิกา เช่น 192.168.1.31)').Trim() }
  if ($ClockHost -notmatch '^[A-Za-z0-9.\-]+$') { Fail "IP/ชื่อเครื่องไม่ถูกต้อง: $ClockHost" }

  $hasClaudeLogin = Test-Path (Join-Path $env:USERPROFILE '.claude\.credentials.json')
  $autoOn = switch ($Auto) {
    'yes' { $true }
    'no' { $false }
    default {
      if (-not $hasClaudeLogin) { Warn 'เครื่องนี้ยังไม่ได้ล็อกอิน Claude Code: การ์ด Claude จะยังใช้ไม่ได้ (การ์ด BTC ใช้ได้)' }
      Ask-YesNo 'เปิดอัปเดตการ์ดอัตโนมัติทุก 10 นาทีตอนเริ่มเซิร์ฟเวอร์ไหม' $true
    }
  }
  $flag = if ($autoOn) { 'true' } else { 'false' }
  $claudeFlag = if ($autoOn -and $hasClaudeLogin) { 'true' } else { 'false' }

  $lines = Get-Content $EnvExample | ForEach-Object {
    switch -Regex ($_) {
      '^CLOCK_HOST=' { "CLOCK_HOST=$ClockHost" }
      '^CARD_INTERVAL_MINUTES=' { 'CARD_INTERVAL_MINUTES=10' }
      '^CARD_AUTO=' { "CARD_AUTO=$claudeFlag" }
      '^BTC_INTERVAL_MINUTES=' { 'BTC_INTERVAL_MINUTES=10' }
      '^BTC_AUTO=' { "BTC_AUTO=$flag" }
      default { $_ }
    }
  }
  Set-Content -Path $EnvFile -Value $lines -Encoding ascii
  Ok "เขียน .env แล้ว (CLOCK_HOST=$ClockHost, Claude auto=$claudeFlag, BTC auto=$flag)"
}

# --- 4. Can we reach the clock? ---
Step 'ทดสอบการเชื่อมต่อนาฬิกา'
$hostLine = Get-Content $EnvFile | Where-Object { $_ -match '^CLOCK_HOST=' } | Select-Object -Last 1
$clock = ($hostLine -split '=', 2)[1].Trim()
try {
  $themes = Invoke-RestMethod "http://$clock/theme/list" -TimeoutSec 5
  Ok "ติดต่อนาฬิกาที่ $clock ได้ ($($themes.themes.Count) ธีม)"
} catch {
  Warn "ติดต่อ $clock ไม่ได้: เช็คว่าเครื่องนี้ต่อ Wi-Fi วงเดียวกับนาฬิกา และ IP ถูกต้อง (แก้ได้ใน control-panel\.env)"
}

# --- 5. Desktop shortcut ---
if (-not $NoShortcut) {
  Step 'Shortcut บน Desktop'
  if (Ask-YesNo 'สร้าง shortcut "Smart Clock Panel" บน Desktop ไหม' $true) {
    $desktop = [Environment]::GetFolderPath('Desktop')
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut((Join-Path $desktop 'Smart Clock Panel.lnk'))
    $shortcut.TargetPath = Join-Path $PanelDir 'Smart Clock Panel.cmd'
    $shortcut.WorkingDirectory = $PanelDir
    $shortcut.WindowStyle = 7   # minimized: hides the brief console flash
    $shortcut.Description = 'Smart Clock control panel'
    $shortcut.Save()
    Ok 'สร้าง shortcut แล้ว (ถ้าย้ายโฟลเดอร์โปรเจกต์ ต้องรันไฟล์นี้ใหม่)'
  }
}

Write-Host "`nเสร็จแล้ว: เปิด 'Smart Clock Panel' แล้วกด 'เริ่มเซิร์ฟเวอร์'" -ForegroundColor Green
Write-Host 'อย่าเปิด panel พร้อมกันหลายเครื่อง เพราะจะสั่งนาฬิกาซ้อนกัน' -ForegroundColor Yellow
