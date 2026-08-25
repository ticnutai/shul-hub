param(
  [string]$SourceRepository = ""
)

$ErrorActionPreference = "Stop"
$expectedRemote = "https://github.com/ticnutai/pash.git"

if (-not $SourceRepository) {
  $documents = [Environment]::GetFolderPath("MyDocuments")
  $SourceRepository = Get-ChildItem -LiteralPath $documents -Directory | Where-Object {
    $gitDirectory = Join-Path $_.FullName ".git"
    if (-not (Test-Path -LiteralPath $gitDirectory)) { return $false }
    $gitConfig = Join-Path $gitDirectory "config"
    $configText = Get-Content -LiteralPath $gitConfig -Raw
    return $configText -match [regex]::Escape($expectedRemote)
  } | Select-Object -First 1 -ExpandProperty FullName
}

if (-not $SourceRepository) {
  throw "Could not locate the read-only pash repository by its exact GitHub remote."
}

$sourceData = Join-Path $SourceRepository "src\data"
$targetData = Join-Path $PSScriptRoot "..\public\torah-data"

function Get-Sha256([string]$Path) {
  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    return ([System.BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace("-", "")
  } finally {
    $stream.Dispose()
    $algorithm.Dispose()
  }
}

if (-not (Test-Path -LiteralPath $sourceData -PathType Container)) {
  throw "Torah data source was not found: $sourceData"
}

$actualRemote = (& git -C $SourceRepository remote get-url origin).Trim()
if ($actualRemote -ne $expectedRemote) {
  throw "Refusing to import from an unexpected repository: $actualRemote"
}

$sourceCommit = (& git -C $SourceRepository rev-parse HEAD).Trim()
New-Item -ItemType Directory -Force -Path $targetData | Out-Null

$sourceFiles = Get-ChildItem -LiteralPath $sourceData -Recurse -File -Filter "*.json"
foreach ($sourceFile in $sourceFiles) {
  $relative = $sourceFile.FullName.Substring($sourceData.Length).TrimStart("\")
  $destination = Join-Path $targetData $relative
  $destinationDirectory = Split-Path -Parent $destination
  New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null
  Copy-Item -LiteralPath $sourceFile.FullName -Destination $destination -Force

  $sourceHash = Get-Sha256 $sourceFile.FullName
  $destinationHash = Get-Sha256 $destination
  if ($sourceHash -ne $destinationHash) {
    throw "Hash mismatch after copying $relative"
  }
}

$manifestFiles = $sourceFiles | ForEach-Object {
  $relative = $_.FullName.Substring($sourceData.Length).TrimStart("\").Replace("\", "/")
  [ordered]@{
    path = $relative
    bytes = $_.Length
    sha256 = (Get-Sha256 $_.FullName).ToLowerInvariant()
  }
}

$manifest = [ordered]@{
  schemaVersion = 1
  sourceRepository = $expectedRemote
  sourceCommit = $sourceCommit
  importMode = "read-only allowlisted JSON copy"
  sourceSupabaseImported = $false
  files = @($manifestFiles)
}

$manifestPath = Join-Path $targetData "content-manifest.json"
$manifestJson = $manifest | ConvertTo-Json -Depth 6
$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($manifestPath, $manifestJson, $utf8WithoutBom)
Write-Output "Imported $($sourceFiles.Count) read-only JSON files from pash commit $sourceCommit"
Write-Output "No environment, authentication, Supabase, source-code, or migration files were copied."
