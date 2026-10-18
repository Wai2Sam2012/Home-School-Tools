<#
.SYNOPSIS
    Downloads about 5 pictures for each key attraction of every US national
    park in the Off-Roading theme, from Wikimedia Commons.

.DESCRIPTION
    Reads the parks and their "Key attractions" from the region files in
    ..\themes\national-parks (alaska.md, california.md, ...), searches
    Wikimedia Commons (the free photo library behind Wikipedia) for each
    attraction, and saves landscape photos into a folder for each park inside
    its region's folder. Every file name starts with the park and the
    attraction, for example:

        <OutputPath>\Southwest\Arches\Arches - Delicate Arch_1.jpg
        <OutputPath>\Alaska\Denali\Denali - Wildlife_3.jpg

    The folders match the ones the game uses (see themes\national-parks\
    PICTURES.md), so chosen pictures can be copied straight into
    themes\national-parks\pictures.

    Commons sends resized copies (1024 pixels wide by default, the size the
    game uses), so most files are 100 to 200 KB and fit the game's limits
    (400 KB, 1600 pixels). Maps, logos, signs
    and diagrams are skipped, and only landscape (wide) photos are kept. If an
    attraction has too few photos, general photos of the park fill the gap.

    Every photo on Commons may be shared, but most require a credit. The
    script writes credits.csv (author, license and source of every picture)
    and CREDITS-lines.md, table lines ready to paste into the theme's
    CREDITS.md for the pictures you keep.

    Failures never stop the run: they are written to download-log.csv and the
    script moves on. Pictures already downloaded are skipped, so the script
    can be re-run to resume.

    Written for Windows PowerShell 5.1; also works in PowerShell 7.

.PARAMETER OutputPath
    Folder to save pictures into. Defaults to themes\national-parks\
    downloaded-pictures, which is excluded from git.

.PARAMETER ListPath
    Folder with the region files. Defaults to arithmetic-odyssey\themes\
    national-parks.

.PARAMETER Park
    Only these parks, by short name (for example: -Park Arches, Zion).

.PARAMETER Region
    Only these regions, by folder name (for example: -Region Alaska, Southwest).

.PARAMETER PicturesPerAttraction
    How many pictures to get for each attraction. Default 5.

.PARAMETER ParkPicturesOnly
    Get pictures of each park as a whole (PicturesPerAttraction of them)
    instead of one set per attraction. Much quicker.

.PARAMETER Width
    Width in pixels of the copies to download. Default 1024 (the size
    recommended in PICTURES.md). The game allows up to 1600.

.PARAMETER ListOnly
    Search and write what would be downloaded to the log, without downloading.

.PARAMETER Force
    Download again even if the files already exist.

.PARAMETER DelayMilliseconds
    Pause between requests, to be polite to Wikimedia. Default 1000.

.PARAMETER TimeoutSeconds
    Timeout for each web request. Default 60.

.PARAMETER MaxPictureMB
    Largest picture to download, in MB. A bigger one is stopped as soon as it
    passes the limit and is not saved. Default 20.

.PARAMETER ApiUrl
    The Wikimedia Commons API address. Only change this for testing.

.PARAMETER UserAgent
    Wikimedia asks every script to say who it is and how to reach its owner.

.EXAMPLE
    .\Get-ParkPictures.ps1 -Park Arches -ListOnly

    Shows which pictures would be downloaded for Arches, without downloading.

.EXAMPLE
    .\Get-ParkPictures.ps1 -Region Southwest

    Downloads about 5 pictures per attraction for the 13 Southwest parks.

.EXAMPLE
    powershell.exe -ExecutionPolicy Bypass -File .\Get-ParkPictures.ps1 -ParkPicturesOnly

    Downloads 5 pictures of each of the 63 parks.

.NOTES
    Exit code 0: everything succeeded (or was skipped).
    Exit code 1: at least one search or picture failed; see download-log.csv.
    Exit code 2: the script could not start (for example, no region files).
#>
[CmdletBinding()]
param(
    [string]$OutputPath,
    [string]$ListPath,
    [string[]]$Park,
    [string[]]$Region,
    [ValidateRange(1, 20)]
    [int]$PicturesPerAttraction = 5,
    [switch]$ParkPicturesOnly,
    [ValidateRange(320, 2560)]
    [int]$Width = 1024,
    [switch]$ListOnly,
    [switch]$Force,
    [ValidateRange(0, 60000)]
    [int]$DelayMilliseconds = 1000,
    [ValidateRange(1, 600)]
    [int]$TimeoutSeconds = 60,
    [ValidateRange(1, 200)]
    [int]$MaxPictureMB = 20,
    [string]$ApiUrl = 'https://commons.wikimedia.org/w/api.php',
    [string]$UserAgent = 'ArithmeticOdyssey-ParkPictures/1.0 (home school project; https://github.com/Wai2Sam2012/Home-School-Tools)'
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
# The progress bar makes Invoke-WebRequest many times slower in PowerShell 5.1.
$ProgressPreference = 'SilentlyContinue'

# PowerShell 5.1 may default to TLS 1.0, which Wikimedia refuses.
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
} catch {
    Write-Verbose "Could not enable TLS 1.2: $($_.Exception.Message)"
}

# Region file -> region folder (the same folders the game uses).
$Regions = [ordered]@{
    'alaska'             = 'Alaska'
    'california'         = 'California'
    'pacific'            = 'Pacific'
    'southwest'          = 'Southwest'
    'rockies-and-plains' = 'Rockies-and-Plains'
    'midwest'            = 'Midwest'
    'east-and-caribbean' = 'East-and-Caribbean'
}
$PictureExtensions = @('.jpg', '.jpeg', '.png', '.webp')
# Titles with these words are usually not photos of the place.
$SkipTitlePattern = '(?i)\b(map|maps|logo|seal|sign|signs|diagram|plan|stamp|coin|poster|brochure|flag|chart|graph|patch|badge|icon|drawing|painting|illustration|postcard|svg)\b'
$MaxPathLength = 250
$MaxBytesForGame = 400KB

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Protect-CsvRow {
    # A copy of a row whose text can't run as a formula when the CSV is opened
    # in Excel: a cell starting with = + - @ (from a web page or Commons) gets
    # a leading apostrophe.
    param($Row)
    $copy = [ordered]@{}
    foreach ($prop in $Row.PSObject.Properties) {
        $value = $prop.Value
        if ($value -is [string] -and $value -match '^[=+\-@\t\r]') { $value = "'" + $value }
        $copy[$prop.Name] = $value
    }
    return [pscustomobject]$copy
}

function Get-Prop {
    # Reads a property that may be missing (Set-StrictMode would otherwise stop the script).
    param($Object, [string]$Name)
    if ($null -eq $Object) { return $null }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    return $property.Value
}

function Get-HttpStatusCode {
    param($ErrorRecord)
    # The web error may be wrapped (a .NET call made inside a function), so
    # look through the inner errors too.
    $exception = $ErrorRecord.Exception
    while ($null -ne $exception) {
        try {
            if ($exception.PSObject.Properties['Response'] -and $null -ne $exception.Response) {
                return [int]$exception.Response.StatusCode
            }
        } catch {
            # Not an HTTP error (DNS failure, timeout, ...).
        }
        $exception = $exception.InnerException
    }
    return 0
}

function Invoke-WithRetry {
    # Runs $Action up to $Attempts times. Retries network errors, 429 (too
    # many requests) and 5xx; gives up at once on other 4xx errors such as 404.
    param([scriptblock]$Action, [int]$Attempts = 4)
    for ($i = 1; $i -le $Attempts; $i++) {
        try {
            return & $Action
        } catch {
            if ($_.Exception -is [System.IO.InvalidDataException]) { throw }
            $code = Get-HttpStatusCode $_
            $retryable = ($code -eq 0) -or ($code -eq 429) -or ($code -ge 500)
            if (-not $retryable -or $i -eq $Attempts) { throw }
            $wait = [int][math]::Pow(2, $i)
            if ($code -eq 429) { $wait = $wait * 5 }
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

function Test-PictureBytes {
    # True when the file starts like a JPEG, PNG, GIF or WebP picture, so a web
    # page or a program saved under a picture name is never kept.
    param([byte[]]$Bytes)
    if ($null -eq $Bytes -or $Bytes.Length -lt 12) { return $false }
    if ($Bytes[0] -eq 0xFF -and $Bytes[1] -eq 0xD8 -and $Bytes[2] -eq 0xFF) { return $true }
    if ($Bytes[0] -eq 0x89 -and $Bytes[1] -eq 0x50 -and $Bytes[2] -eq 0x4E -and $Bytes[3] -eq 0x47) { return $true }
    if ($Bytes[0] -eq 0x47 -and $Bytes[1] -eq 0x49 -and $Bytes[2] -eq 0x46 -and $Bytes[3] -eq 0x38) { return $true }
    $riff = $Bytes[0] -eq 0x52 -and $Bytes[1] -eq 0x49 -and $Bytes[2] -eq 0x46 -and $Bytes[3] -eq 0x46
    $webp = $Bytes[8] -eq 0x57 -and $Bytes[9] -eq 0x45 -and $Bytes[10] -eq 0x42 -and $Bytes[11] -eq 0x50
    return ($riff -and $webp)
}

function Get-LimitedPicture {
    # Downloads one picture into memory: returns @{ Bytes }. Stops as soon as
    # it is bigger than -MaxPictureMB, and refuses anything that is not a JPEG,
    # PNG, GIF or WebP picture over https. Those refusals throw an
    # InvalidDataException, which Invoke-WithRetry does not retry.
    param([string]$Url)
    $limit = [long]$MaxPictureMB * 1024 * 1024
    $request = [System.Net.HttpWebRequest]::Create($Url)
    $request.UserAgent = $UserAgent
    $request.Timeout = $TimeoutSeconds * 1000
    $request.ReadWriteTimeout = $TimeoutSeconds * 1000
    $request.MaximumAutomaticRedirections = 5
    $response = $request.GetResponse()
    try {
        if ($response.ResponseUri.Scheme -ne 'https') {
            throw (New-Object System.IO.InvalidDataException "Moved away from https to $($response.ResponseUri)")
        }
        $contentType = [string]$response.ContentType
        if ($contentType -notmatch '(?i)^image/(jpeg|png|gif|webp)\b') {
            throw (New-Object System.IO.InvalidDataException "Not a picture (Content-Type: $contentType)")
        }
        if ($response.ContentLength -gt $limit) {
            throw (New-Object System.IO.InvalidDataException "Too big ($($response.ContentLength) bytes; the limit is $MaxPictureMB MB)")
        }
        $stream = $response.GetResponseStream()
        $memory = New-Object System.IO.MemoryStream
        $buffer = New-Object byte[] 65536
        while (($read = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
            $memory.Write($buffer, 0, $read)
            if ($memory.Length -gt $limit) {
                throw (New-Object System.IO.InvalidDataException "Too big (over the limit of $MaxPictureMB MB)")
            }
        }
        $bytes = $memory.ToArray()
    } finally {
        $response.Close()
    }
    if ($bytes.Length -eq 0) { throw (New-Object System.IO.InvalidDataException 'Downloaded file is empty') }
    if (-not (Test-PictureBytes $bytes)) {
        throw (New-Object System.IO.InvalidDataException 'The file is not a JPEG, PNG, GIF or WebP picture')
    }
    # In a hashtable, so PowerShell passes the bytes on as one array.
    return @{ Bytes = $bytes }
}

function ConvertTo-PlainText {
    # Turns accented and special letters into plain ones, so folder and file
    # names work everywhere: "Haleakala", "Hawaii Volcanoes", "Wrangell-St. Elias".
    param([string]$Text)
    $t = $Text.Replace([string][char]0x2013, '-').Replace([string][char]0x2014, '-')
    $t = $t.Replace([string][char]0x02BB, '').Replace([string][char]0x2018, '').Replace([string][char]0x2019, '')
    $decomposed = $t.Normalize([Text.NormalizationForm]::FormD)
    $plain = New-Object System.Text.StringBuilder
    foreach ($ch in $decomposed.ToCharArray()) {
        if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
            [void]$plain.Append($ch)
        }
    }
    return $plain.ToString().Normalize([Text.NormalizationForm]::FormC)
}

function Get-SafeName {
    # A Windows-safe folder or file name part: no \ / : * ? " < > | or dots.
    param([string]$Text, [int]$MaxLength = 60)
    $name = ConvertTo-PlainText $Text
    foreach ($c in [System.IO.Path]::GetInvalidFileNameChars()) { $name = $name.Replace([string]$c, ' ') }
    $name = $name.Replace('.', '').Replace("'", '')
    $name = ([regex]::Replace($name, '\s+', ' ')).Trim(' ', '-')
    if ($name.Length -gt $MaxLength) { $name = $name.Substring(0, $MaxLength).Trim() }
    return $name
}

function Get-ShortParkName {
    # "Arches National Park" -> "Arches"; "National Park of American Samoa" -> "American Samoa".
    param([string]$Heading)
    $name = [regex]::Replace($Heading, '(?i)^National Park of (the )?', '')
    $name = [regex]::Replace($name, '(?i)\s+National Parks?(\s+and\s+Preserve)?\s*$', '')
    return (Get-SafeName $name)
}

function Get-ParkList {
    # Reads the region files and returns one object per park, with its attractions.
    param([string]$Folder)
    $parks = New-Object System.Collections.Generic.List[object]
    foreach ($file in $Regions.Keys) {
        $path = Join-Path $Folder "$file.md"
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
            Write-Warning "Region file not found, skipping: $path"
            continue
        }
        $text = Get-Content -LiteralPath $path -Raw -Encoding UTF8
        foreach ($section in [regex]::Split($text, '(?m)^## ')) {
            $lines = $section -split "`r?`n"
            $heading = $lines[0].Trim()
            if ($heading -notmatch '(?i)National Park|Park of') { continue }
            $attractions = New-Object System.Collections.Generic.List[string]
            $inList = $false
            foreach ($line in $lines) {
                if ($line -match '^\*\*Key attractions\*\*') { $inList = $true; continue }
                if ($inList -and $line -match '^\*\*') { break }
                if ($inList) {
                    $m = [regex]::Match($line, '^\s*-\s+\*\*(.+?):?\*\*')
                    if ($m.Success) { $attractions.Add($m.Groups[1].Value.Trim().TrimEnd(':').Trim()) }
                }
            }
            $parks.Add([pscustomobject]@{
                Region      = $Regions[$file]
                Name        = Get-ShortParkName $heading
                FullName    = ConvertTo-PlainText $heading
                Attractions = $attractions.ToArray()
            })
        }
    }
    return ,$parks
}

function Get-StripHtml {
    # The author on Commons is often a link; keep only its text.
    param([string]$Html)
    if ([string]::IsNullOrWhiteSpace($Html)) { return '' }
    $text = [System.Net.WebUtility]::HtmlDecode([regex]::Replace($Html, '<[^>]+>', ' '))
    $text = ([regex]::Replace($text, '\s+', ' ')).Trim()
    if ($text.Length -gt 120) { $text = $text.Substring(0, 117) + '...' }
    return $text
}

function Find-CommonsPicture {
    # Searches Commons and returns usable photos, best match first:
    # JPEG or PNG, landscape, at least 800 pixels wide, not a map or logo.
    param([string]$Query)
    $search = "$Query filetype:bitmap -map -logo"
    $url = $ApiUrl + '?action=query&format=json&formatversion=2&generator=search&gsrnamespace=6&gsrlimit=30' +
        '&gsrsearch=' + [uri]::EscapeDataString($search) +
        '&prop=imageinfo&iiprop=' + [uri]::EscapeDataString('url|size|mime|extmetadata') +
        "&iiurlwidth=$Width" +
        '&iiextmetadatafilter=' + [uri]::EscapeDataString('LicenseShortName|Artist|LicenseUrl')
    $data = Invoke-WithRetry {
        Invoke-RestMethod -Uri $url -UserAgent $UserAgent -TimeoutSec $TimeoutSeconds
    }
    $pages = @(Get-Prop (Get-Prop $data 'query') 'pages')
    $found = New-Object System.Collections.Generic.List[object]
    foreach ($page in ($pages | Where-Object { $null -ne $_ } | Sort-Object { [int](Get-Prop $_ 'index') })) {
        $title = [string](Get-Prop $page 'title')
        $info = @(Get-Prop $page 'imageinfo')
        if ($info.Count -eq 0 -or $null -eq $info[0]) { continue }
        $info = $info[0]
        $mime = [string](Get-Prop $info 'mime')
        $w = [int](Get-Prop $info 'width')
        $h = [int](Get-Prop $info 'height')
        if ($mime -ne 'image/jpeg' -and $mime -ne 'image/png') { continue }
        if ($w -lt 800 -or $w -le $h) { continue }
        if ($title -match $SkipTitlePattern) { continue }
        $download = [string](Get-Prop $info 'thumburl')
        if ([string]::IsNullOrWhiteSpace($download)) { $download = [string](Get-Prop $info 'url') }
        if ([string]::IsNullOrWhiteSpace($download)) { continue }
        # Only pictures from Wikimedia's own picture server, over https.
        $downloadUri = $null
        if (-not [uri]::TryCreate($download, [UriKind]::Absolute, [ref]$downloadUri)) { continue }
        if ($downloadUri.Scheme -ne 'https' -or $downloadUri.Host -ne 'upload.wikimedia.org') { continue }
        $meta = Get-Prop $info 'extmetadata'
        $found.Add([pscustomobject]@{
            Title      = $title
            Url        = $download
            Source     = [string](Get-Prop $info 'descriptionurl')
            Author     = Get-StripHtml ([string](Get-Prop (Get-Prop $meta 'Artist') 'value'))
            License    = Get-StripHtml ([string](Get-Prop (Get-Prop $meta 'LicenseShortName') 'value'))
            LicenseUrl = [string](Get-Prop (Get-Prop $meta 'LicenseUrl') 'value')
        })
    }
    # Returned as separate items (callers collect them with @()); nothing at all when none were found.
    return $found.ToArray()
}

function Save-Picture {
    # Downloads one picture to $Path. Returns @{ Status; Message; Bytes }.
    # Written with .NET calls rather than "Invoke-WebRequest -OutFile", which
    # treats [ and ] in a path as wildcards.
    param([string]$Url, [string]$Path)
    $partPath = "$Path.part"
    try {
        $bytes = (Invoke-WithRetry { Get-LimitedPicture -Url $Url }).Bytes
        [System.IO.File]::WriteAllBytes($partPath, $bytes)
        if ([System.IO.File]::Exists($Path)) { [System.IO.File]::Delete($Path) }
        [System.IO.File]::Move($partPath, $Path)
        return @{ Status = 'Downloaded'; Message = "$($bytes.Length) bytes"; Bytes = $bytes.Length }
    } catch {
        $message = Get-ErrorText $_
        try {
            if ([System.IO.File]::Exists($partPath)) { [System.IO.File]::Delete($partPath) }
        } catch {
            Write-Verbose "Could not remove ${partPath}: $($_.Exception.Message)"
        }
        return @{ Status = 'Failed'; Message = $message; Bytes = 0 }
    }
}

function Get-PictureExtension {
    param([string]$Url)
    $ext = [System.IO.Path]::GetExtension(([uri]$Url).AbsolutePath).ToLowerInvariant()
    if ($PictureExtensions -notcontains $ext) { $ext = '.jpg' }
    if ($ext -eq '.jpeg') { $ext = '.jpg' }
    return $ext
}

function Get-ExistingCount {
    # How many pictures for this attraction (file names "<base>_<n>.<ext>") are already in the folder.
    param([string]$Folder, [string]$Base)
    if (-not [System.IO.Directory]::Exists($Folder)) { return 0 }
    $pattern = '^' + [regex]::Escape($Base) + '_\d+\.(jpg|jpeg|png|webp)$'
    return @([System.IO.Directory]::GetFiles($Folder) | Where-Object { [System.IO.Path]::GetFileName($_) -match $pattern }).Count
}

function Get-FreePath {
    # The next "<base>_<n>.<ext>" name not yet used in the folder.
    param([string]$Folder, [string]$Base, [string]$Ext)
    $n = 1
    while ($true) {
        $taken = $false
        foreach ($e in $PictureExtensions) {
            if ([System.IO.File]::Exists((Join-Path $Folder "${Base}_$n$e"))) { $taken = $true; break }
        }
        if (-not $taken) { return (Join-Path $Folder "${Base}_$n$Ext") }
        $n++
    }
}

function Test-StartedFromExplorer {
    # Right-click > "Run with PowerShell" starts powershell.exe with a command
    # that sets the execution policy; that window closes as soon as the script ends.
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

function Split-List {
    # "powershell.exe -File" passes "-Park A,B" as the single string "A,B".
    param([string[]]$Values)
    $set = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    foreach ($entry in $Values) {
        foreach ($v in $entry.Split(',')) {
            if (-not [string]::IsNullOrWhiteSpace($v)) { [void]$set.Add($v.Trim()) }
        }
    }
    return ,$set
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

trap {
    Write-Host ''
    Write-Host "Unexpected error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "At line $($_.InvocationInfo.ScriptLineNumber): $($_.InvocationInfo.Line.Trim())" -ForegroundColor Red
    Exit-Script 2
}

$scriptFolder = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($scriptFolder)) { $scriptFolder = (Get-Location).Path }
if ([string]::IsNullOrWhiteSpace($ListPath)) {
    $ListPath = Join-Path (Join-Path (Split-Path $scriptFolder -Parent) 'themes') 'national-parks'
}
if ([string]::IsNullOrWhiteSpace($OutputPath)) { $OutputPath = Join-Path $ListPath 'downloaded-pictures' }
Write-Host "Script folder:  $scriptFolder"
Write-Host "Pictures go to: $OutputPath"

$apiUri = $null
if (-not [uri]::TryCreate($ApiUrl, [UriKind]::Absolute, [ref]$apiUri)) {
    Write-Error "ApiUrl is not a valid address: $ApiUrl" -ErrorAction Continue
    Exit-Script 2
}

# ToArray(): @() on a List[object] can throw "Argument types do not match".
$parks = (Get-ParkList -Folder $ListPath).ToArray()
if ($parks.Count -eq 0) {
    Write-Error ("No parks found in the region files in: $ListPath`n" +
        "This script reads alaska.md, california.md, ... from arithmetic-odyssey\themes\national-parks. Keep it in " +
        "'arithmetic-odyssey\tools' (download or clone the whole repository), or pass -ListPath.") -ErrorAction Continue
    Exit-Script 2
}

if ($Region) {
    $wanted = Split-List $Region
    foreach ($r in $wanted) {
        if (-not ($Regions.Values | Where-Object { $_ -eq $r })) { Write-Warning "Unknown region: $r (use $($Regions.Values -join ', '))" }
    }
    $parks = @($parks | Where-Object { $wanted.Contains($_.Region) })
}
if ($Park) {
    $wanted = Split-List $Park
    foreach ($p in $wanted) {
        if (-not ($parks | Where-Object { $_.Name -eq $p })) { Write-Warning "Park not found: $p" }
    }
    $parks = @($parks | Where-Object { $wanted.Contains($_.Name) })
}
if (@($parks).Count -eq 0) {
    Write-Error 'None of the requested parks are in the region files.' -ErrorAction Continue
    Exit-Script 2
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
$creditsPath = Join-Path $OutputPath 'credits.csv'
$creditLinesPath = Join-Path $OutputPath 'CREDITS-lines.md'
$log = New-Object System.Collections.Generic.List[object]

# Credits from earlier runs, so pictures already downloaded are not fetched again.
$credits = New-Object System.Collections.Generic.List[object]
$doneTitles = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
if ([System.IO.File]::Exists($creditsPath) -and -not $Force) {
    try {
        foreach ($row in @(Import-Csv -LiteralPath $creditsPath)) {
            $relative = ($row.File -replace '^pictures/', '').Replace('/', [string][System.IO.Path]::DirectorySeparatorChar)
            if ([System.IO.File]::Exists((Join-Path $OutputPath $relative))) {
                $credits.Add($row)
                [void]$doneTitles.Add($row.Park + '|' + $row.Title)
            }
        }
    } catch {
        Write-Warning "Could not read ${creditsPath}: $($_.Exception.Message)"
    }
}

function Add-LogEntry {
    param($ParkInfo, [string]$Attraction, [string]$Status, [string]$File, [string]$Message, [string]$Source = '')
    $log.Add([pscustomobject]@{
        Time       = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
        Region     = $ParkInfo.Region
        Park       = $ParkInfo.Name
        Attraction = $Attraction
        Status     = $Status
        File       = $File
        Source     = $Source
        Message    = $Message
    })
}

$jobs = 0
foreach ($p in $parks) { if ($ParkPicturesOnly -or $p.Attractions.Count -eq 0) { $jobs++ } else { $jobs += $p.Attractions.Count } }
$mode = 'Downloading'
if ($ListOnly) { $mode = 'Listing (no downloads)' }
Write-Host "$mode about $PicturesPerAttraction pictures for $jobs attraction(s) in $(@($parks).Count) park(s)"
Write-Host 'Pictures come from Wikimedia Commons. Credits are written to credits.csv.'

$index = 0
foreach ($p in $parks) {
    $index++
    Write-Host ("[{0}/{1}] {2} / {3}" -f $index, @($parks).Count, $p.Region, $p.Name)
    $folder = Join-Path (Join-Path $OutputPath $p.Region) $p.Name
    $parkTitles = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    $parkResults = $null # general photos of the park, searched only if needed

    $targets = @($p.Attractions)
    if ($ParkPicturesOnly -or $targets.Count -eq 0) { $targets = @('') }
    foreach ($attraction in $targets) {
        $label = $attraction
        $base = $p.Name
        $query = $p.FullName
        if ($attraction) {
            $base = "$($p.Name) - $(Get-SafeName $attraction 40)"
            $query = "$(ConvertTo-PlainText $attraction) $($p.FullName)"
        } else {
            $label = '(whole park)'
        }

        $have = 0
        if (-not $Force) { $have = Get-ExistingCount $folder $base }
        if ($have -ge $PicturesPerAttraction) {
            Add-LogEntry $p $label 'Skipped' '' "already have $have picture(s) (use -Force to download again)"
            Write-Host "  ${label}: already have $have"
            continue
        }

        try {
            $candidates = @(Find-CommonsPicture $query)
        } catch {
            $message = Get-ErrorText $_
            Write-Warning "  ${label}: search failed: $message"
            Add-LogEntry $p $label 'SearchFailed' '' $message
            Start-Sleep -Milliseconds $DelayMilliseconds
            continue
        }
        Start-Sleep -Milliseconds $DelayMilliseconds

        # Too few photos of this attraction: fill up with photos of the park.
        $fresh = @($candidates | Where-Object { -not $parkTitles.Contains($_.Title) -and -not $doneTitles.Contains($p.Name + '|' + $_.Title) })
        $fromPark = 0
        if ($attraction -and $fresh.Count -lt ($PicturesPerAttraction - $have)) {
            if ($null -eq $parkResults) {
                try {
                    $parkResults = @(Find-CommonsPicture $p.FullName)
                } catch {
                    $parkResults = @()
                    Add-LogEntry $p '(whole park)' 'SearchFailed' '' (Get-ErrorText $_)
                }
                Start-Sleep -Milliseconds $DelayMilliseconds
            }
            $extra = @($parkResults | Where-Object {
                $t = $_.Title
                -not $parkTitles.Contains($t) -and -not $doneTitles.Contains($p.Name + '|' + $t) -and -not ($fresh | Where-Object { $_.Title -eq $t })
            })
            $fromPark = [math]::Min($extra.Count, $PicturesPerAttraction - $have - $fresh.Count)
            if ($fromPark -gt 0) { $fresh = @($fresh) + @($extra[0..($fromPark - 1)]) }
        }

        $wantCount = $PicturesPerAttraction - $have
        # All suitable photos, best first; the loop stops once it has enough,
        # so a picture that fails to download is replaced by the next one.
        $chosen = @($fresh)
        if ($chosen.Count -eq 0) {
            Write-Warning "  ${label}: no suitable photos found"
            Add-LogEntry $p $label 'NoPictures' '' "no landscape photos found for: $query"
            continue
        }

        $got = 0
        $listed = 0
        $failedHere = New-Object System.Collections.Generic.List[object]
        foreach ($pic in $chosen) {
            if ($got -ge $wantCount -or $listed -ge $wantCount) { break }
            [void]$parkTitles.Add($pic.Title)
            if (-not [System.IO.Directory]::Exists($folder) -and -not $ListOnly) {
                [void][System.IO.Directory]::CreateDirectory($folder)
            }
            $path = Get-FreePath $folder $base (Get-PictureExtension $pic.Url)
            if ($ListOnly) {
                # Nothing is saved, so number the listed pictures by hand.
                $listed++
                $path = Join-Path $folder "${base}_$($have + $listed)$(Get-PictureExtension $pic.Url)"
            }
            $relative = 'pictures/' + $p.Region + '/' + $p.Name + '/' + [System.IO.Path]::GetFileName($path)
            if ($ListOnly) {
                Add-LogEntry $p $label 'Listed' $path "$($pic.Title) | $($pic.License) | $($pic.Author)" $pic.Url
                continue
            }
            if ($path.Length -ge $MaxPathLength) {
                Add-LogEntry $p $label 'Failed' $path 'path is too long for Windows; use a shorter -OutputPath' $pic.Url
                continue
            }
            $result = Save-Picture -Url $pic.Url -Path $path
            Start-Sleep -Milliseconds $DelayMilliseconds
            if ($result.Status -eq 'Downloaded') {
                $got++
                [void]$doneTitles.Add($p.Name + '|' + $pic.Title)
                $credits.Add([pscustomobject]@{
                    File       = $relative
                    Park       = $p.Name
                    Attraction = $label
                    Title      = $pic.Title
                    Source     = $pic.Source
                    Author     = $pic.Author
                    License    = $pic.License
                    LicenseUrl = $pic.LicenseUrl
                })
                $note = $result.Message
                if ($result.Bytes -gt $MaxBytesForGame) { $note += ' (over 400 KB: make it smaller before adding it to the game)' }
                Add-LogEntry $p $label 'Downloaded' $path $note $pic.Url
            } else {
                Write-Warning "  Failed: $($pic.Url) - $($result.Message)"
                Add-LogEntry $p $label 'Failed' $path $result.Message $pic.Url
                $failedHere.Add($log[$log.Count - 1])
            }
        }
        # A picture that failed but was replaced by another one is not a problem.
        if ($got -ge $wantCount) {
            foreach ($entry in $failedHere) {
                $entry.Status = 'Replaced'
                $entry.Message = 'another picture was downloaded instead; ' + $entry.Message
            }
        }
        $extraNote = ''
        if ($fromPark -gt 0) { $extraNote = " ($fromPark of them general park photos)" }
        if ($ListOnly) {
            Write-Host "  ${label}: $listed found$extraNote"
        } else {
            Write-Host "  ${label}: $got downloaded$extraNote"
        }
    }
}

try {
    $log | ForEach-Object { Protect-CsvRow $_ } | Export-Csv -LiteralPath $logPath -NoTypeInformation -Encoding UTF8
    Write-Host "Log written to $logPath"
} catch {
    Write-Warning "Could not write the log to ${logPath}: $($_.Exception.Message)"
}

if (-not $ListOnly -and $credits.Count -gt 0) {
    try {
        $credits | ForEach-Object { Protect-CsvRow $_ } | Export-Csv -LiteralPath $creditsPath -NoTypeInformation -Encoding UTF8
        # Table lines for CREDITS.md: copy the lines for the pictures you keep.
        $lines = New-Object System.Collections.Generic.List[string]
        $lines.Add('| Picture file | National park | Source | License or permission |')
        $lines.Add('| --- | --- | --- | --- |')
        foreach ($c in ($credits | Sort-Object File)) {
            $author = $c.Author
            if ([string]::IsNullOrWhiteSpace($author)) { $author = 'unknown author' }
            $license = $c.License
            if ($c.LicenseUrl) { $license = "[$($c.License)]($($c.LicenseUrl))" }
            $lines.Add("| ``$($c.File)`` | $($c.Park) | [Wikimedia Commons]($($c.Source)), $($author.Replace('|', '/')) | $license |")
        }
        [System.IO.File]::WriteAllLines($creditLinesPath, $lines.ToArray(), (New-Object System.Text.UTF8Encoding $false))
        Write-Host "Credits written to $creditsPath and $creditLinesPath"
    } catch {
        Write-Warning "Could not write the credits: $($_.Exception.Message)"
    }
}

Write-Host ''
Write-Host 'Summary:'
$log | Group-Object Status | Sort-Object Name | ForEach-Object {
    Write-Host ("  {0,-12} {1}" -f $_.Name, $_.Count)
}
Write-Host ''
Write-Host "Pictures are in: $OutputPath"

$failures = @($log | Where-Object { $_.Status -eq 'Failed' -or $_.Status -eq 'SearchFailed' })
if ($failures.Count -gt 0) {
    Write-Warning "$($failures.Count) item(s) failed. See $logPath for details."
    Exit-Script 1
}
Exit-Script 0
