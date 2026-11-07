import { spawn } from "node:child_process"

// PowerShell also ends a '...' string at curly single quotes.
const q = (s: string) => `'${s.replace(/['‘-‛]/g, "$&$&")}'`

// Windows tray icon via PowerShell: click or "Open dashboard" opens it, "Quit upgo" stops the server.
export function showTray(url: string, onQuit: () => void): void {
    const open = `{ Start-Process ${q(url)} }`
    const exit = "[System.Windows.Forms.Application]::Exit()"
    const script = `
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = [System.Drawing.Icon]::ExtractAssociatedIcon(${q(process.execPath)})
$tray.Text = 'upgo dashboard'
$menu = New-Object System.Windows.Forms.ContextMenuStrip
[void]$menu.Items.Add('Open dashboard', $null, ${open})
[void]$menu.Items.Add('Quit upgo', $null, { ${exit} })
$tray.ContextMenuStrip = $menu
$tray.add_MouseClick({ if ($_.Button -eq [System.Windows.Forms.MouseButtons]::Left) ${open} })
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 3000
$timer.add_Tick({ if (-not (Get-Process -Id ${process.pid} -ErrorAction SilentlyContinue)) { ${exit} } })
$timer.Start()
$tray.Visible = $true
[System.Windows.Forms.Application]::Run()
$tray.Dispose()
`
    const ps = spawn(
        "powershell",
        ["-NoProfile", "-NonInteractive", "-Sta", "-ExecutionPolicy", "Bypass", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")],
        { windowsHide: true, stdio: "ignore" },
    )
    ps.on("exit", onQuit)
    ps.on("error", onQuit)
}
