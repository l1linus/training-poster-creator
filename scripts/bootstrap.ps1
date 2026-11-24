param(
  [int]$Port = 4173
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Write-Log([string]$Message) {
  [Console]::Error.WriteLine($Message)
}

function Get-NodeMajor([string]$Exe) {
  try {
    $version = & $Exe -v 2>$null
    if ($version -match 'v(\d+)') { return [int]$Matches[1] }
  } catch {}
  return 0
}

$nodeExe = $null
$systemNode = Get-Command node -ErrorAction SilentlyContinue
if ($systemNode -and (Get-NodeMajor $systemNode.Source) -ge 20) {
  $nodeExe = $systemNode.Source
}

if (-not $nodeExe) {
  $runtime = Join-Path $Root '.runtime'
  $nodeDir = Join-Path $runtime 'node'
  $candidate = Join-Path $nodeDir 'node.exe'
  if (-not (Test-Path $candidate)) {
    Write-Log 'Node.js 20+ not found. Downloading portable Node.js v22.14.0 (about 35 MB)...'
    New-Item -ItemType Directory -Force -Path $runtime | Out-Null
    $zip = Join-Path $runtime 'node.zip'
    $version = 'v22.14.0'
    $urls = @(
      "https://npmmirror.com/mirrors/node/$version/node-$version-win-x64.zip",
      "https://nodejs.org/dist/$version/node-$version-win-x64.zip"
    )
    $downloaded = $false
    foreach ($url in $urls) {
      try {
        Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
        $downloaded = $true
        break
      } catch {
        Write-Log "Download failed: $url"
      }
    }
    if (-not $downloaded) {
      throw 'Failed to download Node.js. Check network and retry.'
    }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $extractDir = Join-Path $runtime 'unzip'
    if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
    [System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $extractDir)
    $inner = Get-ChildItem $extractDir -Directory | Select-Object -First 1
    if (Test-Path $nodeDir) { Remove-Item $nodeDir -Recurse -Force }
    Move-Item $inner.FullName $nodeDir
    Remove-Item $extractDir -Recurse -Force
    Remove-Item $zip -Force
  }
  $nodeExe = Join-Path $nodeDir 'node.exe'
}

Write-Log "Using Node: $nodeExe"
& $nodeExe scripts/open-ui.mjs --port $Port --no-open
exit $LASTEXITCODE
