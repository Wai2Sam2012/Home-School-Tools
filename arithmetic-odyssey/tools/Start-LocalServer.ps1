<#
.SYNOPSIS
    Runs a small web server on this computer so the game can be tested in a
    browser at http://localhost:8080/arithmetic-odyssey/.

.DESCRIPTION
    Serves the whole Home-School-Tools repository, so the game opens under a
    subfolder just like on the published site
    (https://USERNAME.github.io/Home-School-Tools/arithmetic-odyssey/).

    A web server is needed because browsers only allow offline mode (service
    workers) and JavaScript modules from http://localhost or HTTPS, not from a
    file opened by double-clicking.

    The server only listens on this computer (localhost); other devices on the
    network cannot reach it. Files are sent with "no-cache" so changes show up
    on the next reload. Press Ctrl+C to stop it.

    Before starting, it rebuilds the game's story files
    (themes\<theme>\storyline.json) so newly added pictures show up, and the
    offline app (sw.js) with the list of files to save. This needs Node.js;
    without it the server still runs, using the files from the last build.

    The offline app keeps a saved copy of the game in the browser. After
    changing the game's files, restart this server (it rebuilds sw.js), then
    open the game and reload once: the new version takes over on the start
    screen. Or use "Offline: delete the saved copy" in the debug panel
    (?debug=1).

    Works in Windows PowerShell 5.1 and PowerShell 7.

.PARAMETER Port
    The port to listen on. Default 8080. Use another number if 8080 is busy.

.PARAMETER Root
    The folder to serve. Defaults to the Home-School-Tools repository folder
    (two folders up from this script).

.PARAMETER NoBrowser
    Don't open the game in the default browser after starting.

.EXAMPLE
    .\Start-LocalServer.ps1

    Starts the server and opens http://localhost:8080/arithmetic-odyssey/.

.EXAMPLE
    powershell.exe -ExecutionPolicy Bypass -File .\Start-LocalServer.ps1 -Port 8081

    Starts the server on port 8081 without changing the execution policy.
#>
[CmdletBinding()]
param(
    [ValidateRange(1024, 65535)]
    [int]$Port = 8080,
    [string]$Root,
    [switch]$NoBrowser
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$ContentTypes = @{
    '.html'        = 'text/html; charset=utf-8'
    '.htm'         = 'text/html; charset=utf-8'
    '.css'         = 'text/css; charset=utf-8'
    '.js'          = 'text/javascript; charset=utf-8'
    '.mjs'         = 'text/javascript; charset=utf-8'
    '.json'        = 'application/json; charset=utf-8'
    '.webmanifest' = 'application/manifest+json; charset=utf-8'
    '.md'          = 'text/markdown; charset=utf-8'
    '.txt'         = 'text/plain; charset=utf-8'
    '.svg'         = 'image/svg+xml'
    '.png'         = 'image/png'
    '.jpg'         = 'image/jpeg'
    '.jpeg'        = 'image/jpeg'
    '.gif'         = 'image/gif'
    '.webp'        = 'image/webp'
    '.ico'         = 'image/x-icon'
    '.mp3'         = 'audio/mpeg'
    '.m4a'         = 'audio/mp4'
    '.wav'         = 'audio/wav'
    '.ogg'         = 'audio/ogg'
    '.woff2'       = 'font/woff2'
}

function Get-ContentType {
    param([string]$Path)
    $ext = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
    if ($ContentTypes.ContainsKey($ext)) { return $ContentTypes[$ext] }
    return 'application/octet-stream'
}

function Resolve-RequestPath {
    # Maps a URL path to a file path inside $RootPath. Returns $null if the
    # path would leave the served folder (for example /../secret.txt).
    param([string]$RootPath, [string]$UrlPath)
    $sep = [System.IO.Path]::DirectorySeparatorChar
    $relative = [uri]::UnescapeDataString($UrlPath).TrimStart('/').Replace('/', $sep)
    $full = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($RootPath, $relative))
    $rootTrimmed = $RootPath.TrimEnd($sep)
    if ($full.TrimEnd($sep) -eq $rootTrimmed) { return $full }
    if ($full.StartsWith($rootTrimmed + $sep, [StringComparison]::OrdinalIgnoreCase)) { return $full }
    return $null
}

function Send-Response {
    param($Response, [int]$Status, [string]$ContentType, [byte[]]$Body, [bool]$HeadOnly)
    $Response.StatusCode = $Status
    $Response.ContentType = $ContentType
    $Response.Headers['Cache-Control'] = 'no-cache'
    $Response.Headers['X-Content-Type-Options'] = 'nosniff'
    $Response.ContentLength64 = $Body.Length
    if (-not $HeadOnly -and $Body.Length -gt 0) {
        $Response.OutputStream.Write($Body, 0, $Body.Length)
    }
}

function Send-Text {
    param($Response, [int]$Status, [string]$Message, [bool]$HeadOnly)
    $html = "<!doctype html><meta charset=utf-8><title>$Status</title><p>$Message</p>"
    Send-Response $Response $Status 'text/html; charset=utf-8' ([System.Text.Encoding]::UTF8.GetBytes($html)) $HeadOnly
}

function Invoke-Request {
    param($Context, [string]$RootPath)
    $request = $Context.Request
    $response = $Context.Response
    $urlPath = $request.Url.AbsolutePath
    $status = 500
    try {
        $headOnly = $request.HttpMethod -eq 'HEAD'
        if ($request.HttpMethod -ne 'GET' -and -not $headOnly) {
            $status = 405
            Send-Text $response 405 'Only GET and HEAD are supported.' $false
            return
        }
        $path = Resolve-RequestPath $RootPath $urlPath
        if ($null -eq $path) {
            $status = 403
            Send-Text $response 403 'Forbidden.' $headOnly
            return
        }
        if ([System.IO.Directory]::Exists($path)) {
            if (-not $urlPath.EndsWith('/')) {
                # Folders must end with "/" so the page's relative links
                # (css/style.css, js/app.js) point inside the folder.
                $status = 301
                $response.Headers['Location'] = $urlPath + '/' + $request.Url.Query
                Send-Text $response 301 'Moved.' $headOnly
                return
            }
            $path = [System.IO.Path]::Combine($path, 'index.html')
        }
        if (-not [System.IO.File]::Exists($path)) {
            $status = 404
            Send-Text $response 404 "Not found: $([System.Net.WebUtility]::HtmlEncode($urlPath))" $headOnly
            return
        }
        $status = 200
        Send-Response $response 200 (Get-ContentType $path) ([System.IO.File]::ReadAllBytes($path)) $headOnly
    } catch {
        $status = 500
        try { Send-Text $response 500 'Server error.' $false } catch { Write-Verbose $_.Exception.Message }
        Write-Warning "Error serving ${urlPath}: $($_.Exception.Message)"
    } finally {
        try { $response.OutputStream.Close() } catch { Write-Verbose $_.Exception.Message }
        Write-Host ("{0}  {1,-4} {2} {3}" -f (Get-Date -Format 'HH:mm:ss'), $request.HttpMethod, $status, $urlPath)
    }
}

function Invoke-StorylineBuild {
    # Rebuilds themes\<theme>\storyline.json with Node.js, if it is installed.
    # Problems are reported but don't stop the server.
    param([string]$RootPath)
    $buildScript = [System.IO.Path]::Combine($RootPath, 'arithmetic-odyssey', 'tools', 'build-storyline.mjs')
    if (-not [System.IO.File]::Exists($buildScript)) { return }
    $node = Get-Command node -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $node) {
        Write-Warning ('Node.js was not found, so the story files were not rebuilt and new pictures may not show. ' +
            'Install the LTS version from https://nodejs.org/ and start the server again.')
        return
    }
    Write-Host 'Building the story files...'
    & $node.Path $buildScript | Out-Host
    if ($LASTEXITCODE -ne 0) {
        Write-Warning 'The story files have problems (listed above). Fix them, then start the server again.'
        Write-Host ''
        return
    }
    # The offline app (sw.js) lists every file the game needs, so build it
    # after the story files. Without it the game still runs, but not offline.
    $offlineScript = [System.IO.Path]::Combine($RootPath, 'arithmetic-odyssey', 'tools', 'build-offline.mjs')
    if ([System.IO.File]::Exists($offlineScript)) {
        Write-Host 'Building the offline app (sw.js)...'
        & $node.Path $offlineScript | Out-Host
        if ($LASTEXITCODE -ne 0) {
            Write-Warning 'The offline app could not be built (see above). The game runs, but not offline.'
        }
    }
    Write-Host ''
}

# ---------------------------------------------------------------------------

$scriptFolder = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($scriptFolder)) { $scriptFolder = (Get-Location).Path }
if ([string]::IsNullOrWhiteSpace($Root)) {
    $Root = Split-Path (Split-Path $scriptFolder -Parent) -Parent
}
$Root = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Root)
if (-not [System.IO.Directory]::Exists($Root)) {
    Write-Error "Folder to serve not found: $Root" -ErrorAction Continue
    exit 2
}
$Root = [System.IO.Path]::GetFullPath($Root)
Invoke-StorylineBuild $Root

$prefix = "http://localhost:$Port/"
$gameUrl = "${prefix}arithmetic-odyssey/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
    $listener.Start()
} catch {
    Write-Error ("Could not start the server on port ${Port}: $($_.Exception.Message)`n" +
        "Another program may be using that port. Try: .\Start-LocalServer.ps1 -Port 8081") -ErrorAction Continue
    exit 1
}

Write-Host "Serving $Root"
Write-Host "Game:       $gameUrl"
Write-Host "Debug mode: ${gameUrl}?debug=1"
Write-Host 'Press Ctrl+C to stop.'
Write-Host ''

if (-not $NoBrowser -and $env:OS -eq 'Windows_NT') {
    try { Start-Process $gameUrl } catch { Write-Warning "Could not open the browser: $($_.Exception.Message)" }
}

try {
    while ($listener.IsListening) {
        # Wait in short steps so Ctrl+C can stop the server between requests.
        $pending = $listener.GetContextAsync()
        while (-not $pending.AsyncWaitHandle.WaitOne(300)) { }
        Invoke-Request $pending.GetAwaiter().GetResult() $Root
    }
} finally {
    $listener.Stop()
    $listener.Close()
    Write-Host 'Server stopped.'
}
