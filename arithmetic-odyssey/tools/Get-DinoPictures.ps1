<#
.SYNOPSIS
    Downloads the pictures for every dinosaur in the Dino list files from
    dinosaurpictures.org.

.DESCRIPTION
    Reads the dinosaur names from the "[Site page](...)" links in
    triassic.md, jurassic.md and cretaceous.md (in ..\themes\dino),
    opens each dinosaur's gallery page, and saves its images into a folder
    for that dinosaur inside its period's folder. Every file name starts with
    the dinosaur's name, for example:

        <OutputPath>\Triassic\Eoraptor\Eoraptor_1.jpg
        <OutputPath>\Jurassic\Stegosaurus\Stegosaurus_skeleton.jpg

    Where the site offers a resized copy of a picture, the original full-size
    picture is downloaded, and the resized copy is used only if the original
    cannot be downloaded.

    Only images hosted on dinosaurpictures.org (and its subdomains, such as
    images.dinosaurpictures.org) are downloaded unless -IncludeExternalHosts is
    given. Gallery pages also show thumbnails of related dinosaurs, so by
    default only images whose URL contains the dinosaur's name are kept. If a
    page has no such images, all of its site-hosted images are kept and the
    log marks them as "unfiltered" so you can review them.

    Failures never stop the run: a page or image that fails is written to the
    log and the script moves on. Images that already exist are skipped, so
    the script can be re-run to resume an interrupted download.

    Written for Windows PowerShell 5.1.

    The pictures on dinosaurpictures.org are collected from many artists and
    their licenses are often unclear. Keep the downloaded copies for personal
    use and do not commit them to a public repository.

.PARAMETER OutputPath
    Folder to save pictures into. Defaults to the "downloaded-pictures" folder
    in the Dino theme folder (themes\dino\downloaded-pictures). That folder is
    excluded from git.

.PARAMETER ListPath
    Folder that holds the Triassic.md, Jurassic.md and Cretaceous.md dinosaur
    list files. Defaults to arithmetic-odyssey\themes\dino. -SummaryPath is
    still accepted as another name for it.

.PARAMETER Dinosaur
    Only process these dinosaurs (for example: -Dinosaur Eoraptor, Stegosaurus).
    Names are the ones used in the site page links. Defaults to all of them.

.PARAMETER ListOnly
    Find the image URLs and write them to the log without downloading anything.
    Useful for checking what would be downloaded first.

.PARAMETER Force
    Download images again even if the file already exists.

.PARAMETER IncludeExternalHosts
    Also download images hosted outside dinosaurpictures.org.

.PARAMETER MaxImagesPerDinosaur
    Download at most this many images per dinosaur. 0 (the default) means no
    limit.

.PARAMETER DelayMilliseconds
    Pause between requests so the site is not flooded. Default 1000 (1 second).

.PARAMETER TimeoutSeconds
    Timeout for each web request. Default 60.

.PARAMETER SiteUrl
    Base URL of the site. Only change this for testing.

.PARAMETER UserAgent
    User-Agent header sent with each request.

.EXAMPLE
    .\Get-DinoPictures.ps1 -Dinosaur Eoraptor -ListOnly

    Shows which Eoraptor images would be downloaded, without downloading.

.EXAMPLE
    .\Get-DinoPictures.ps1

    Downloads the pictures for all dinosaurs in the list files.

.EXAMPLE
    powershell.exe -ExecutionPolicy Bypass -File .\Get-DinoPictures.ps1 -MaxImagesPerDinosaur 5

    Runs the script without changing the machine's execution policy and keeps
    at most 5 pictures per dinosaur.

.NOTES
    Exit code 0 means every page and image succeeded (or was skipped).
    Exit code 1 means at least one page or image failed; see download-log.csv.
    Exit code 2 means the script could not start (for example, the dinosaur
    list files were not found).
#>
[CmdletBinding()]
param(
    [string]$OutputPath,
    [Alias('SummaryPath')]
    [string]$ListPath,
    [string[]]$Dinosaur,
    [switch]$ListOnly,
    [switch]$Force,
    [switch]$IncludeExternalHosts,
    [ValidateRange(0, 1000)]
    [int]$MaxImagesPerDinosaur = 0,
    [ValidateRange(0, 60000)]
    [int]$DelayMilliseconds = 1000,
    [ValidateRange(1, 600)]
    [int]$TimeoutSeconds = 60,
    [string]$SiteUrl = 'https://dinosaurpictures.org',
    [string]$UserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
# The progress bar makes Invoke-WebRequest many times slower in PowerShell 5.1.
$ProgressPreference = 'SilentlyContinue'

# PowerShell 5.1 may default to TLS 1.0, which most HTTPS sites now refuse.
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
} catch {
    Write-Verbose "Could not enable TLS 1.2: $($_.Exception.Message)"
}

$Periods = @('Triassic', 'Jurassic', 'Cretaceous')
$ImageExtensions = @('.jpg', '.jpeg', '.png', '.gif', '.webp')
$MaxFileNameLength = 80
$MaxPathLength = 250

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Get-HttpStatusCode {
    param($ErrorRecord)
    try {
        $response = $ErrorRecord.Exception.Response
        if ($null -ne $response) { return [int]$response.StatusCode }
    } catch {
        # Not an HTTP error (DNS failure, timeout, ...).
    }
    return 0
}

function Invoke-WithRetry {
    # Runs $Action up to $Attempts times. Retries network errors, 429 and 5xx;
    # gives up at once on other 4xx errors such as 404.
    param(
        [scriptblock]$Action,
        [int]$Attempts = 3
    )
    for ($i = 1; $i -le $Attempts; $i++) {
        try {
            return & $Action
        } catch {
            $code = Get-HttpStatusCode $_
            $retryable = ($code -eq 0) -or ($code -eq 429) -or ($code -ge 500)
            if (-not $retryable -or $i -eq $Attempts) { throw }
            $wait = [int][math]::Pow(2, $i)
            Write-Verbose "Attempt $i failed ($($_.Exception.Message)); retrying in $wait s"
            Start-Sleep -Seconds $wait
        }
    }
}

function Get-ErrorText {
    param($ErrorRecord)
    $code = Get-HttpStatusCode $ErrorRecord
    if ($code -gt 0) { return "HTTP $code - $($ErrorRecord.Exception.Message)" }
    return $ErrorRecord.Exception.Message
}

function Get-ListFile {
    # Returns the path of a period's list file. The files are named in lowercase
    # (triassic.md); a capitalized name (Triassic.md) is also accepted.
    param([string]$Folder, [string]$Period)
    $lower = Join-Path $Folder "$($Period.ToLowerInvariant()).md"
    if (Test-Path -LiteralPath $lower -PathType Leaf) { return $lower }
    return (Join-Path $Folder "$Period.md")
}

function Get-DinoPage {
    # Reads the dinosaur list files and returns one object per dinosaur page.
    param([string]$Folder, [string]$BaseUrl)
    $pages = New-Object System.Collections.Generic.List[object]
    $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    $linkPattern = 'dinosaurpictures\.org/([A-Za-z0-9_-]+)-pictures'

    foreach ($period in $Periods) {
        $file = Get-ListFile $Folder $period
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
            Write-Warning "Dinosaur list file not found, skipping period: $file"
            continue
        }
        $text = Get-Content -LiteralPath $file -Raw -Encoding UTF8
        foreach ($m in [regex]::Matches($text, $linkPattern)) {
            $name = $m.Groups[1].Value
            if ($seen.Add($name)) {
                $pages.Add([pscustomobject]@{
                    Period = $period
                    Name   = $name
                    Url    = "$BaseUrl/$name-pictures"
                })
            }
        }
    }
    return ,$pages
}

function Test-SiteHost {
    param([uri]$Uri, [string]$SiteHost)
    $h = $Uri.Host.ToLowerInvariant()
    $s = $SiteHost.ToLowerInvariant()
    return ($h -eq $s) -or $h.EndsWith(".$s")
}

function Get-OriginalImageUrl {
    # Image-resizing services wrap the original picture's address inside their
    # own, for example:
    #   /cdn-cgi/image/width=400,format=auto/https://images.dinosaurpictures.org/x.jpg
    #   /_next/image?url=https%3A%2F%2Fimages.dinosaurpictures.org%2Fx.jpg&w=640
    # Returns the wrapped original address, or $null if there is none.
    param([string]$Candidate)
    $query = [regex]::Match($Candidate, '(?i)[?&](?:url|src|image)=(https?(?::|%3A)[^&]+)')
    if ($query.Success) { return [uri]::UnescapeDataString($query.Groups[1].Value) }
    $embedded = [regex]::Matches($Candidate, '(?i)https?://')
    if ($embedded.Count -gt 0) {
        $last = $embedded[$embedded.Count - 1]
        if ($last.Index -gt 0) { return $Candidate.Substring($last.Index) }
    }
    return $null
}

function Get-ImageUrl {
    # Finds the images in a gallery page. Returns
    # @{ Images = <objects with Url and Fallbacks>; Filter = 'name' | 'unfiltered' }.
    # Url is the original full-size picture; Fallbacks are resized copies to
    # try if the original cannot be downloaded.
    param(
        [string]$Html,
        [uri]$PageUri,
        [string]$Name,
        [string]$SiteHost,
        [bool]$AllowExternal
    )
    $attrPattern = '(?i)\b(src|data-src|data-original|data-lazy-src|data-full|href|content|srcset|data-srcset)\s*=\s*["'']([^"'']+)["'']'
    $candidates = New-Object System.Collections.Generic.List[string]
    foreach ($m in [regex]::Matches($Html, $attrPattern)) {
        $attr = $m.Groups[1].Value.ToLowerInvariant()
        $value = [System.Net.WebUtility]::HtmlDecode($m.Groups[2].Value)
        if ($attr.EndsWith('srcset')) {
            # srcset holds "url 400w, url 800w". Addresses can contain commas
            # themselves (width=400,format=auto), so only split after a size
            # descriptor or at a comma followed by a space.
            foreach ($part in [regex]::Split($value, '(?<=\s[0-9.]+[wxh])\s*,\s*|,\s+')) {
                $candidate = ($part.Trim() -split '\s+')[0].TrimEnd(',')
                if ($candidate) { $candidates.Add($candidate) }
            }
        } else {
            $candidate = $value.Trim()
            if ($candidate) { $candidates.Add($candidate) }
        }
    }

    $byUrl = New-Object 'System.Collections.Generic.Dictionary[string,object]' ([StringComparer]::OrdinalIgnoreCase)
    $all = New-Object System.Collections.Generic.List[object]
    foreach ($candidate in $candidates) {
        $resolved = $null
        if (-not [uri]::TryCreate($PageUri, [string]$candidate, [ref]$resolved)) { continue }
        $primary = $resolved
        $original = Get-OriginalImageUrl $candidate
        if ($original) {
            $originalUri = $null
            if ([uri]::TryCreate([string]$original, [UriKind]::Absolute, [ref]$originalUri)) { $primary = $originalUri }
        }
        if ($primary.Scheme -ne 'http' -and $primary.Scheme -ne 'https') { continue }
        $ext = [System.IO.Path]::GetExtension($primary.AbsolutePath).ToLowerInvariant()
        if ($ImageExtensions -notcontains $ext) { continue }
        if (-not $AllowExternal -and -not (Test-SiteHost $primary $SiteHost)) { continue }
        if ($primary.AbsolutePath -match '(?i)(logo|favicon|sprite|placeholder)') { continue }

        $key = $primary.AbsoluteUri
        if (-not $byUrl.ContainsKey($key)) {
            $image = [pscustomobject]@{ Url = $key; Fallbacks = (New-Object System.Collections.Generic.List[string]) }
            $byUrl[$key] = $image
            $all.Add($image)
        }
        # Keep the resized copy as a fallback, but only if it is on the site.
        $copy = $resolved.AbsoluteUri
        if ($copy -ne $key -and -not $byUrl[$key].Fallbacks.Contains($copy) -and
            ($AllowExternal -or (Test-SiteHost $resolved $SiteHost))) {
            $byUrl[$key].Fallbacks.Add($copy)
        }
    }

    # The name must start a word, so "Compsognathus" does not match
    # "Procompsognathus" and "Coelophysis" does not match "Eucoelophysis".
    $namePattern = '(?i)(^|[^a-z])' + [regex]::Escape($Name)
    $matched = @($all | Where-Object { ([uri]$_.Url).AbsolutePath -match $namePattern })
    if ($matched.Count -gt 0) {
        return @{ Images = $matched; Filter = 'name' }
    }
    # ToArray() rather than @($all): @() on an empty List[object] throws
    # "Argument types do not match".
    return @{ Images = $all.ToArray(); Filter = 'unfiltered' }
}

function Get-SafeFileName {
    # Builds a Windows-safe file name from the image URL that always starts
    # with the dinosaur's name, e.g. "scene1.jpg" -> "Herrerasaurus_scene1.jpg".
    param([uri]$Uri, [string]$Name)
    $leaf = [uri]::UnescapeDataString(($Uri.AbsolutePath -split '/')[-1])
    foreach ($c in [System.IO.Path]::GetInvalidFileNameChars()) {
        $leaf = $leaf.Replace([string]$c, '_')
    }
    $leaf = $leaf.Trim(' ', '.')
    $ext = [System.IO.Path]::GetExtension($leaf)
    $base = [System.IO.Path]::GetFileNameWithoutExtension($leaf)
    if ([string]::IsNullOrWhiteSpace($ext)) { $ext = '.jpg' }
    if ([string]::IsNullOrWhiteSpace($base)) {
        $base = $Name
    } elseif ($base.StartsWith($Name, [StringComparison]::OrdinalIgnoreCase)) {
        # Already named after the dinosaur; just match the name's capitalization.
        $base = $Name + $base.Substring($Name.Length)
    } else {
        $base = "${Name}_$base"
    }
    $maxBase = $MaxFileNameLength - $ext.Length
    if ($base.Length -gt $maxBase) { $base = $base.Substring(0, $maxBase) }
    return "$base$ext"
}

function Get-UniqueFileName {
    # Gives two different URLs with the same file name different local names.
    param([string]$FileName, [hashtable]$Used)
    $candidate = $FileName
    $base = [System.IO.Path]::GetFileNameWithoutExtension($FileName)
    $ext = [System.IO.Path]::GetExtension($FileName)
    $n = 2
    while ($Used.ContainsKey($candidate.ToLowerInvariant())) {
        $candidate = "${base}_$n$ext"
        $n++
    }
    $Used[$candidate.ToLowerInvariant()] = $true
    return $candidate
}

function Save-Image {
    # Downloads one image to $Path. Returns @{ Status = ...; Message = ... }.
    # Files are written with .NET calls rather than "Invoke-WebRequest -OutFile",
    # because -OutFile treats [ and ] in a path as wildcards and fails on names
    # such as "Staurikosaurus[2012]_2492.jpg".
    param([string]$Url, [string]$Path)
    $partPath = "$Path.part"
    try {
        $response = Invoke-WithRetry {
            Invoke-WebRequest -Uri $Url -UseBasicParsing -UserAgent $UserAgent -TimeoutSec $TimeoutSeconds
        }
        $contentType = [string]($response.Headers['Content-Type'] -join ';')
        if ($contentType -and $contentType -notmatch '(?i)^image/') {
            throw "Not an image (Content-Type: $contentType)"
        }
        $bytes = $response.RawContentStream.ToArray()
        if ($bytes.Length -eq 0) { throw 'Downloaded file is empty' }
        [System.IO.File]::WriteAllBytes($partPath, $bytes)
        if ([System.IO.File]::Exists($Path)) { [System.IO.File]::Delete($Path) }
        [System.IO.File]::Move($partPath, $Path)
        return @{ Status = 'Downloaded'; Message = "$($bytes.Length) bytes" }
    } catch {
        $message = Get-ErrorText $_
        try {
            if ([System.IO.File]::Exists($partPath)) { [System.IO.File]::Delete($partPath) }
        } catch {
            Write-Verbose "Could not remove ${partPath}: $($_.Exception.Message)"
        }
        return @{ Status = 'Failed'; Message = $message }
    }
}

function Test-StartedFromExplorer {
    # Right-click > "Run with PowerShell" in File Explorer starts powershell.exe
    # with a command that sets the execution policy and then runs this script.
    # That window closes as soon as the script ends, hiding any messages.
    if ($Host.Name -ne 'ConsoleHost') { return $false }
    return ([Environment]::CommandLine -match 'Set-ExecutionPolicy\s+-Scope\s+Process\s+Bypass')
}

function Exit-Script {
    # Ends the script, first pausing if the window would otherwise close.
    param([int]$Code)
    if (Test-StartedFromExplorer) {
        Write-Host ''
        try { Read-Host 'Press Enter to close this window' | Out-Null } catch { }
    }
    exit $Code
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

# Any error not handled below ends the run with a message instead of a
# window that silently disappears.
trap {
    Write-Host ''
    Write-Host "Unexpected error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "At line $($_.InvocationInfo.ScriptLineNumber): $($_.InvocationInfo.Line.Trim())" -ForegroundColor Red
    Exit-Script 2
}

$scriptFolder = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($scriptFolder)) { $scriptFolder = (Get-Location).Path }
# The script lives in arithmetic-odyssey\tools; the Dino theme is in arithmetic-odyssey\themes\dino.
if ([string]::IsNullOrWhiteSpace($ListPath)) {
    $ListPath = Join-Path (Join-Path (Split-Path $scriptFolder -Parent) 'themes') 'dino'
}
if ([string]::IsNullOrWhiteSpace($OutputPath)) { $OutputPath = Join-Path $ListPath 'downloaded-pictures' }
$SiteUrl = $SiteUrl.TrimEnd('/')
Write-Host "Script folder:  $scriptFolder"
Write-Host "Pictures go to: $OutputPath"

$siteUri = $null
if (-not [uri]::TryCreate($SiteUrl, [UriKind]::Absolute, [ref]$siteUri)) {
    Write-Error "SiteUrl is not a valid URL: $SiteUrl" -ErrorAction Continue
    Exit-Script 2
}
$missingLists = @($Periods | Where-Object { -not (Test-Path -LiteralPath (Get-ListFile $ListPath $_) -PathType Leaf) })
if ($missingLists.Count -eq $Periods.Count) {
    Write-Error ("Dinosaur list files not found in: $ListPath`n" +
        "This script reads triassic.md, jurassic.md and cretaceous.md from arithmetic-odyssey\themes\dino. Keep it in " +
        "'arithmetic-odyssey\tools' (download or clone the whole repository), " +
        "or pass -ListPath.") -ErrorAction Continue
    Exit-Script 2
}

$pages = Get-DinoPage -Folder $ListPath -BaseUrl $SiteUrl
if ($pages.Count -eq 0) {
    Write-Error "No dinosaurpictures.org links found in the dinosaur list files in $ListPath." -ErrorAction Continue
    Exit-Script 2
}

if ($Dinosaur) {
    $wanted = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    # "powershell.exe -File" passes "-Dinosaur A,B" as the single string "A,B".
    foreach ($entry in $Dinosaur) {
        foreach ($d in $entry.Split(',')) {
            if (-not [string]::IsNullOrWhiteSpace($d)) { [void]$wanted.Add($d.Trim()) }
        }
    }
    foreach ($d in $wanted) {
        if (-not ($pages | Where-Object { $_.Name -eq $d })) {
            Write-Warning "Dinosaur not found in the list files: $d"
        }
    }
    $pages = @($pages | Where-Object { $wanted.Contains($_.Name) })
    if ($pages.Count -eq 0) {
        Write-Error 'None of the requested dinosaurs are in the list files.' -ErrorAction Continue
        Exit-Script 2
    }
}

try {
    # Make the path absolute the way PowerShell sees it; .NET file calls would
    # otherwise resolve a relative path from a different current folder.
    $OutputPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)
    [void][System.IO.Directory]::CreateDirectory($OutputPath)
    if (-not [System.IO.Directory]::Exists($OutputPath)) { throw 'the folder was not created' }
} catch {
    Write-Error "Cannot create output folder ${OutputPath}: $($_.Exception.Message)" -ErrorAction Continue
    Exit-Script 2
}
$logPath = Join-Path $OutputPath 'download-log.csv'
$log = New-Object System.Collections.Generic.List[object]

function Add-LogEntry {
    param($Page, [string]$ImageUrl, [string]$Status, [string]$File, [string]$Message)
    $log.Add([pscustomobject]@{
        Time     = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
        Period   = $Page.Period
        Dinosaur = $Page.Name
        PageUrl  = $Page.Url
        ImageUrl = $ImageUrl
        Status   = $Status
        File     = $File
        Message  = $Message
    })
}

$mode = 'Downloading'
if ($ListOnly) { $mode = 'Listing (no downloads)' }
Write-Host "$mode pictures for $($pages.Count) dinosaurs into $OutputPath"

$index = 0
# File names already used in each dinosaur's folder, so two different images
# with the same name do not overwrite (or skip) each other.
$usedNamesByFolder = @{}
foreach ($page in $pages) {
    $index++
    Write-Host ("[{0}/{1}] {2} ({3})" -f $index, $pages.Count, $page.Name, $page.Period)

    try {
        $response = Invoke-WithRetry {
            Invoke-WebRequest -Uri $page.Url -UseBasicParsing -UserAgent $UserAgent -TimeoutSec $TimeoutSeconds
        }
    } catch {
        $message = Get-ErrorText $_
        Write-Warning "  Could not open page: $message"
        Add-LogEntry $page '' 'PageFailed' '' $message
        Start-Sleep -Milliseconds $DelayMilliseconds
        continue
    }
    Start-Sleep -Milliseconds $DelayMilliseconds

    $found = Get-ImageUrl -Html ([string]$response.Content) -PageUri ([uri]$page.Url) -Name $page.Name `
        -SiteHost $siteUri.Host -AllowExternal ([bool]$IncludeExternalHosts)
    $images = @($found.Images)
    if ($images.Count -eq 0) {
        Write-Warning '  No images found on the page.'
        Add-LogEntry $page '' 'NoImages' '' 'No matching images found on the page'
        continue
    }
    if ($found.Filter -eq 'unfiltered') {
        Write-Warning "  No image URLs contain '$($page.Name)'; keeping all $($images.Count) site images. Review them for pictures of other dinosaurs."
    }
    if ($MaxImagesPerDinosaur -gt 0 -and $images.Count -gt $MaxImagesPerDinosaur) {
        $images = @($images[0..($MaxImagesPerDinosaur - 1)])
    }
    Write-Host "  Found $($images.Count) image(s)"

    # Each dinosaur gets its own folder: <OutputPath>\<Period>\<Dinosaur>\
    $periodFolder = Join-Path $OutputPath $page.Period
    $folder = Join-Path $periodFolder $page.Name
    $folderKey = "$($page.Period)\$($page.Name)"
    if (-not $usedNamesByFolder.ContainsKey($folderKey)) { $usedNamesByFolder[$folderKey] = @{} }
    $usedNames = $usedNamesByFolder[$folderKey]
    foreach ($image in $images) {
        $url = $image.Url
        $fileName = Get-UniqueFileName (Get-SafeFileName -Uri ([uri]$url) -Name $page.Name) $usedNames
        $path = Join-Path $folder $fileName
        $note = ''
        if ($found.Filter -eq 'unfiltered') { $note = 'unfiltered; ' }

        if ($ListOnly) {
            Add-LogEntry $page $url 'Listed' $path "${note}not downloaded (-ListOnly)"
            continue
        }
        if ($path.Length -ge $MaxPathLength) {
            Add-LogEntry $page $url 'Failed' $path "${note}path is too long for Windows; use a shorter -OutputPath"
            continue
        }

        if (-not [System.IO.Directory]::Exists($folder)) {
            [void][System.IO.Directory]::CreateDirectory($folder)
        }

        # Earlier versions saved pictures straight into the period folder.
        # Move those into the dinosaur's folder instead of downloading again.
        $oldPath = Join-Path $periodFolder $fileName
        if (-not $Force -and -not [System.IO.File]::Exists($path) -and [System.IO.File]::Exists($oldPath)) {
            try {
                [System.IO.File]::Move($oldPath, $path)
                Add-LogEntry $page $url 'Moved' $path "${note}moved from $oldPath (already downloaded)"
                continue
            } catch {
                Write-Warning "  Could not move $oldPath : $($_.Exception.Message). Downloading again."
            }
        }

        if ([System.IO.File]::Exists($path) -and -not $Force) {
            Add-LogEntry $page $url 'Skipped' $path "${note}already downloaded (use -Force to download again)"
            continue
        }

        # Try the original picture first, then any resized copies of it.
        $errors = New-Object System.Collections.Generic.List[string]
        $result = $null
        foreach ($attempt in @(@($url) + @($image.Fallbacks))) {
            $result = Save-Image -Url $attempt -Path $path
            Start-Sleep -Milliseconds $DelayMilliseconds
            if ($result.Status -eq 'Downloaded') {
                if ($attempt -ne $url) {
                    $result.Message += " (resized copy from $attempt; original failed: $($errors -join '; '))"
                }
                break
            }
            $errors.Add($result.Message)
        }
        if ($result.Status -eq 'Failed') {
            $result.Message = $errors -join ' | then resized copy: '
            Write-Warning "  Failed: $url - $($result.Message)"
        }
        Add-LogEntry $page $url $result.Status $path ($note + $result.Message)
    }
}

try {
    $log | Export-Csv -LiteralPath $logPath -NoTypeInformation -Encoding UTF8
    Write-Host "Log written to $logPath"
} catch {
    Write-Warning "Could not write the log to ${logPath}: $($_.Exception.Message)"
}

Write-Host ''
Write-Host 'Summary:'
$log | Group-Object Status | Sort-Object Name | ForEach-Object {
    Write-Host ("  {0,-11} {1}" -f $_.Name, $_.Count)
}
Write-Host ''
Write-Host "Pictures are in: $OutputPath"

$failures = @($log | Where-Object { $_.Status -eq 'Failed' -or $_.Status -eq 'PageFailed' })
if ($failures.Count -gt 0) {
    Write-Warning "$($failures.Count) item(s) failed. See $logPath for details."
    Exit-Script 1
}
Exit-Script 0
