# Local preview server for the static site (no dependencies, Windows PowerShell 5.1+).
#
#   .\scripts\serve.ps1
#   .\scripts\serve.ps1 -Port 8080
#
# Then open http://localhost:8787/ — stop with Ctrl+C.

param(
	[int]$Port = 8787
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

Write-Host "RunDownRec site serving from $root" -ForegroundColor Green
Write-Host "Open http://localhost:$Port/  (Ctrl+C to stop)" -ForegroundColor Cyan

$mime = @{
	'.html' = 'text/html; charset=utf-8'
	'.css'  = 'text/css; charset=utf-8'
	'.js'   = 'text/javascript; charset=utf-8'
	'.json' = 'application/json; charset=utf-8'
	'.svg'  = 'image/svg+xml'
	'.txt'  = 'text/plain; charset=utf-8'
	'.zip'  = 'application/zip'
	'.png'  = 'image/png'
	'.webp' = 'image/webp'
	'.ico'  = 'image/x-icon'
}

try {
	while ($listener.IsListening) {
		$context = $listener.GetContext()
		$requestPath = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath)

		# Resolve inside $root only — blocks ../ traversal.
		$relative = $requestPath.TrimStart('/')
		if (-not $relative) { $relative = 'index.html' }
		$candidate = Join-Path $root $relative
		$full = [System.IO.Path]::GetFullPath($candidate)

		if (-not $full.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
			$context.Response.StatusCode = 403
			$context.Response.Close()
			continue
		}

		if (Test-Path -LiteralPath $full -PathType Container) {
			$full = Join-Path $full 'index.html'
		}

		if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
			$notFound = Join-Path $root '404.html'
			if (Test-Path -LiteralPath $notFound) {
				$context.Response.StatusCode = 404
				$body = [System.IO.File]::ReadAllBytes($notFound)
				$context.Response.ContentType = $mime['.html']
				$context.Response.OutputStream.Write($body, 0, $body.Length)
			}
			else {
				$context.Response.StatusCode = 404
			}
			$context.Response.Close()
			continue
		}

		$extension = [System.IO.Path]::GetExtension($full).ToLower()
		$context.Response.ContentType = if ($mime.ContainsKey($extension)) { $mime[$extension] } else { 'application/octet-stream' }
		# Always fresh during local editing, so JSON changes show up on reload.
		$context.Response.Headers.Add('Cache-Control', 'no-store')
		$context.Response.SendChunked = $false

		$body = [System.IO.File]::ReadAllBytes($full)
		$context.Response.ContentLength64 = $body.Length
		$context.Response.OutputStream.Write($body, 0, $body.Length)
		$context.Response.Close()
	}
}
finally {
	$listener.Stop()
	$listener.Close()
}
