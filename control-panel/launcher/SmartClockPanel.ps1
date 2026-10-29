# Smart Clock Panel launcher: a small window to start/stop the control-panel
# server, show its status, and open the web page. Windows PowerShell 5.1 + WinForms,
# nothing to install. Saved as UTF-8 with BOM so PowerShell 5.1 reads the Thai text.

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$PanelDir = Split-Path -Parent $PSScriptRoot
$StateDir = Join-Path $PanelDir '.state'
$LogFile = Join-Path $StateDir 'server.log'

function Read-EnvValue([string]$Name, [string]$Default) {
  $envFile = Join-Path $PanelDir '.env'
  if (Test-Path $envFile) {
    $line = Get-Content $envFile | Where-Object { $_ -match "^\s*$Name\s*=" } | Select-Object -Last 1
    if ($line) { return ($line -split '=', 2)[1].Trim() }
  }
  return $Default
}

$Port = [int](Read-EnvValue 'PORT' '8787')
$BindHost = Read-EnvValue 'BIND_HOST' '127.0.0.1'
$WebHost = if ($BindHost -eq '0.0.0.0') { '127.0.0.1' } else { $BindHost }
$PanelUrl = "http://${WebHost}:$Port"

function Find-Node {
  $command = Get-Command node -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  # A launcher started from Explorer may have a PATH from before Node was installed.
  $fallback = Join-Path $env:ProgramFiles 'nodejs\node.exe'
  if (Test-Path $fallback) { return $fallback }
  return $null
}

function Get-ServerProcess {
  $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $listener) { return $null }
  return Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
}

function Test-IsOurServer($Process) {
  return $Process.Name -eq 'node.exe' -and $Process.CommandLine -match 'server\.mjs'
}

function Get-PanelJson([string]$Path) {
  try { return Invoke-RestMethod -Uri "$PanelUrl$Path" -TimeoutSec 2 } catch { return $null }
}

function Show-Message([string]$Text, [string]$Icon = 'Information') {
  [System.Windows.Forms.MessageBox]::Show($Text, 'Smart Clock Panel', 'OK', $Icon) | Out-Null
}

function Format-Time([string]$Iso) {
  return ([datetime]::Parse($Iso)).ToLocalTime().ToString('HH:mm')
}

# --- window ---
$font = New-Object System.Drawing.Font('Leelawadee UI', 10)
$form = New-Object System.Windows.Forms.Form
$form.Text = 'Smart Clock Panel'
$form.ClientSize = New-Object System.Drawing.Size(440, 400)
$form.FormBorderStyle = 'FixedSingle'
$form.MaximizeBox = $false
$form.StartPosition = 'CenterScreen'
$form.Font = $font
$form.BackColor = [System.Drawing.Color]::FromArgb(28, 28, 30)
$form.ForeColor = [System.Drawing.Color]::FromArgb(242, 242, 247)

$green = [System.Drawing.Color]::FromArgb(52, 199, 89)
$amber = [System.Drawing.Color]::FromArgb(255, 159, 10)
$red = [System.Drawing.Color]::FromArgb(255, 69, 58)
$muted = [System.Drawing.Color]::FromArgb(152, 152, 159)

function New-Label([int]$X, [int]$Y, [int]$Width, [int]$Height = 24) {
  $label = New-Object System.Windows.Forms.Label
  $label.Location = New-Object System.Drawing.Point($X, $Y)
  $label.Size = New-Object System.Drawing.Size($Width, $Height)
  $form.Controls.Add($label)
  return $label
}

function New-Button([string]$Text, [int]$X, [int]$Y, [int]$Width) {
  $button = New-Object System.Windows.Forms.Button
  $button.Text = $Text
  $button.Location = New-Object System.Drawing.Point($X, $Y)
  $button.Size = New-Object System.Drawing.Size($Width, 38)
  $button.FlatStyle = 'Flat'
  $button.FlatAppearance.BorderSize = 0
  $button.BackColor = [System.Drawing.Color]::FromArgb(44, 44, 46)
  $button.ForeColor = $form.ForeColor
  $button.Cursor = 'Hand'
  $form.Controls.Add($button)
  return $button
}

$title = New-Label 20 16 400 30
$title.Text = 'Smart Clock Panel'
$title.Font = New-Object System.Drawing.Font('Leelawadee UI', 14, [System.Drawing.FontStyle]::Bold)

$dot = New-Label 20 56 22
$dot.Text = '●'
$statusLabel = New-Label 42 56 380
$statusLabel.Font = New-Object System.Drawing.Font('Leelawadee UI', 10, [System.Drawing.FontStyle]::Bold)

$cardLabel = New-Label 20 86 400
$cardLabel.ForeColor = $muted
$lastLabel = New-Label 20 110 400
$lastLabel.ForeColor = $muted
$pinLabel = New-Label 20 134 400
$pinLabel.ForeColor = $muted

$startButton = New-Button 'เริ่มเซิร์ฟเวอร์' 20 170 128
$startButton.BackColor = $green
$startButton.ForeColor = [System.Drawing.Color]::FromArgb(4, 33, 13)
$stopButton = New-Button 'หยุดเซิร์ฟเวอร์' 156 170 128
$openButton = New-Button 'เปิดหน้าเว็บ' 292 170 128

$logTitle = New-Label 20 222 400
$logTitle.Text = 'Log'
$logTitle.ForeColor = $muted
$logBox = New-Object System.Windows.Forms.TextBox
$logBox.Multiline = $true
$logBox.ReadOnly = $true
$logBox.ScrollBars = 'Vertical'
$logBox.Location = New-Object System.Drawing.Point(20, 246)
$logBox.Size = New-Object System.Drawing.Size(400, 136)
$logBox.Font = New-Object System.Drawing.Font('Consolas', 9)
$logBox.BackColor = [System.Drawing.Color]::FromArgb(11, 11, 12)
$logBox.ForeColor = $muted
$logBox.BorderStyle = 'None'
$form.Controls.Add($logBox)

# --- actions ---
$script:starting = $false

function Start-Server {
  if (Get-ServerProcess) { return }
  $node = Find-Node
  if (-not $node) {
    Show-Message 'ไม่พบ Node.js กรุณาติดตั้ง Node.js 22 ขึ้นไป' 'Error'
    return
  }
  New-Item -ItemType Directory -Force $StateDir | Out-Null
  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName = $env:ComSpec
  # cmd writes the output to a file, so the server never blocks on a full pipe
  # and keeps running after this window closes.
  $startInfo.Arguments = "/d /c `"`"$node`" server.mjs > `"$LogFile`" 2>&1`""
  $startInfo.WorkingDirectory = $PanelDir
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  [System.Diagnostics.Process]::Start($startInfo) | Out-Null
  $script:starting = $true
  Update-Status
}

function Stop-Server {
  $process = Get-ServerProcess
  if (-not $process) { return }
  # Never kill some other program that happens to use the port.
  if (-not (Test-IsOurServer $process)) {
    Show-Message "พอร์ต $Port ถูกใช้โดยโปรแกรมอื่น ($($process.Name)) จึงไม่ได้ปิดให้" 'Warning'
    return
  }
  Stop-Process -Id $process.ProcessId -Force
  $script:starting = $false
  Update-Status
}

function Update-Log {
  if (-not (Test-Path $LogFile)) { return }
  $lines = Get-Content $LogFile -Tail 40 -Encoding UTF8 -ErrorAction SilentlyContinue
  $text = ($lines -join "`r`n")
  if ($logBox.Text -ne $text) {
    $logBox.Text = $text
    $logBox.SelectionStart = $logBox.TextLength
    $logBox.ScrollToCaret()
  }
}

function Update-Status {
  $process = Get-ServerProcess
  $running = $process -and (Test-IsOurServer $process)

  if ($running) {
    $script:starting = $false
    $dot.ForeColor = $green
    $statusLabel.Text = "กำลังทำงาน · $PanelUrl"
    $card = Get-PanelJson '/api/card'
    $display = Get-PanelJson '/api/display'
    if ($card) {
      $cardLabel.Text = if ($card.auto) { "อัปเดตการ์ดอัตโนมัติ: เปิด (ทุก $($card.intervalMinutes) นาที)" } else { 'อัปเดตการ์ดอัตโนมัติ: ปิด' }
      $run = $card.lastRun
      $lastLabel.Text = if (-not $run) { 'การ์ดล่าสุด: ยังไม่เคยส่ง' }
        elseif ($run.ok) { "การ์ดล่าสุด: $(Format-Time $run.at) · $(if ($run.pushed) { 'ส่งขึ้นนาฬิกาแล้ว' } else { 'ตัวอย่าง' })" }
        else { "การ์ดล่าสุด: $(Format-Time $run.at) · ล้มเหลว: $($run.error)" }
      $lastLabel.ForeColor = if ($run -and -not $run.ok) { $red } else { $muted }
    }
    if ($display) {
      $pinLabel.Text = if ($display.pinned) { "บนจอ: ล็อกการ์ดไว้ตั้งแต่ $(Format-Time $display.since)" } else { 'บนจอ: แสดงตามปกติ' }
    }
  } elseif ($process) {
    $dot.ForeColor = $red
    $statusLabel.Text = "พอร์ต $Port ถูกโปรแกรมอื่นใช้อยู่ ($($process.Name))"
  } elseif ($script:starting) {
    $dot.ForeColor = $amber
    $statusLabel.Text = 'กำลังเริ่ม…'
  } else {
    $dot.ForeColor = $muted
    $statusLabel.Text = 'หยุดอยู่'
  }

  if (-not $running) {
    $cardLabel.Text = ''
    $lastLabel.Text = ''
    $pinLabel.Text = ''
  }
  $startButton.Enabled = -not $process -and -not $script:starting
  # Flat buttons keep their colour when disabled, so grey the green one out by hand.
  $startButton.BackColor = if ($startButton.Enabled) { $green } else { [System.Drawing.Color]::FromArgb(44, 44, 46) }
  $stopButton.Enabled = [bool]$running
  $openButton.Enabled = [bool]$running
  Update-Log
}

$startButton.Add_Click({ Start-Server })
$stopButton.Add_Click({ Stop-Server })
$openButton.Add_Click({ Start-Process $PanelUrl })

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 2000
$startedAt = $null
$timer.Add_Tick({
  # A start that never listens (bad .env, port clash) shows its error in the log.
  if ($script:starting -and -not (Get-ServerProcess)) {
    if (-not $script:startedAt) { $script:startedAt = Get-Date }
    elseif (((Get-Date) - $script:startedAt).TotalSeconds -gt 10) { $script:starting = $false }
  } else { $script:startedAt = $null }
  Update-Status
})

$form.Add_FormClosing({
  param($sender, $e)
  $process = Get-ServerProcess
  if (-not ($process -and (Test-IsOurServer $process))) { return }
  $answer = [System.Windows.Forms.MessageBox]::Show(
    "หยุดเซิร์ฟเวอร์ด้วยไหม?`n`nใช่ = หยุด`nไม่ = ให้ทำงานต่อเบื้องหลัง (การ์ดยังอัปเดตต่อ)",
    'Smart Clock Panel', 'YesNoCancel', 'Question')
  if ($answer -eq 'Cancel') { $e.Cancel = $true }
  elseif ($answer -eq 'Yes') { Stop-Server }
})

$form.Add_Shown({ Update-Status; $timer.Start() })
[System.Windows.Forms.Application]::Run($form)
