# Adds a build to the site: prints a ready-to-paste JSON entry with real size + SHA-256.
#
#   .\scripts\add-file.ps1 downloads\my-build.zip
#   .\scripts\add-file.ps1 C:\Users\benne\Downloads\my-build.zip -Move   # copies it into downloads/ first
#   .\scripts\add-file.ps1 downloads\my-build.zip -Label "client zip" -Clip
param(
	[Parameter(Mandatory = $true, Position = 0)]
	[string]$Path,

	[string]$Label,
	[switch]$Move,
	[switch]$Clip
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$downloadsDir = Join-Path $root 'downloads'

if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
	Write-Error "File not found: $Path"
}

$item = Get-Item -LiteralPath $Path

if ($Move) {
	if (-not (Test-Path -LiteralPath $downloadsDir)) {
		New-Item -ItemType Directory -Path $downloadsDir | Out-Null
	}
	$target = Join-Path $downloadsDir $item.Name
	if ($item.FullName -ne $target) {
		Copy-Item -LiteralPath $item.FullName -Destination $target -Force
		Write-Host "Copied to $target" -ForegroundColor DarkGray
	}
	$item = Get-Item -LiteralPath $target
}

# The site references files relative to its root, so only downloads/ is servable.
# PowerShell 5.1 has no [Path]::GetRelativePath, so strip the root prefix by hand.
$rootFull = [System.IO.Path]::GetFullPath($root).TrimEnd('\', '/')
$fullPath = [System.IO.Path]::GetFullPath($item.FullName)

if (-not $fullPath.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
	Write-Error "File is outside the site folder: $fullPath`nCopy it into downloads/ or re-run with -Move."
}

$relative = $fullPath.Substring($rootFull.Length).TrimStart('\', '/')

if ($relative -notlike 'downloads*') {
	Write-Error "Put the file in the downloads/ folder (or re-run with -Move). Got: $relative"
}

$webPath = ($relative -replace '\\', '/')
if (-not $Label) {
	$Label = Split-Path -Leaf $webPath
}

$hash = (Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash.ToLower()
$size = $item.Length

# uploadedAt in UTC, matching what the site renders in the Uploaded column.
$uploadedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

$entry = [ordered]@{
	name        = (Split-Path -Leaf $webPath) -replace '\.[^.]+$', ''
	version     = 'YYYY.MM.DD'
	date        = (Get-Date).ToString('yyyy-MM-dd')
	manifestId  = ''
	status      = 'ready'
	notes       = 'TODO: developer notes for this build'
	uploadedAt  = $uploadedAt
	files       = @([ordered]@{ label = $Label; path = $webPath; size = $size; sha256 = $hash })
}

$json = $entry | ConvertTo-Json -Depth 5
Write-Host "`nPaste this into the `"entries`" array of data/clients.json (or data/special-clients.json):`n" -ForegroundColor Cyan
Write-Output $json

if ($Clip) {
	Set-Clipboard -Value $json
	Write-Host "Copied to clipboard." -ForegroundColor Green
}

Write-Host "`n$($item.Name): $size bytes, sha256 $hash" -ForegroundColor DarkGray
