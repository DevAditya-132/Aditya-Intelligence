[CmdletBinding()]
param()

try {
  $ErrorActionPreference = 'Stop'
  $Root = Split-Path -Parent $MyInvocation.MyCommand.Path
  $Runtime = Join-Path $Root '.runtime'
  $ElectronDir = Join-Path $Runtime 'electron'
  $LlamaDir = Join-Path $Runtime 'llama'
  $ModelsDir = Join-Path $Runtime 'models'
  $ModelPath = Join-Path $ModelsDir 'qwen2.5-1.5b-instruct-q4_k_m.gguf'

function Get-ReleaseAsset([string]$Repository, [scriptblock]$AssetFilter, [string]$Destination) {
  $headers = @{ 'User-Agent' = 'OfflineChat-Setup' }
  $releases = @(Invoke-RestMethod -Headers $headers -Uri "https://api.github.com/repos/$Repository/releases?per_page=20")
  $asset = $null
  foreach ($release in $releases) {
    $asset = $release.assets | Where-Object { & $AssetFilter $_.name } | Select-Object -First 1
    if ($asset) { break }
  }
  if (-not $asset) {
    $available = @($releases | ForEach-Object { $_.assets } | Select-Object -First 20 -ExpandProperty name) -join ', '
    throw "No matching release asset was found in the latest 20 releases of $Repository. Available assets include: $available"
  }
  Write-Host "Downloading $($asset.name)..."
  Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $Destination
}

function Expand-ReleaseArchive([string]$Archive, [string]$Destination, [string]$RequiredFile) {
  Expand-Archive -Force -Path $Archive -DestinationPath $Destination

  $requiredPath = Get-ChildItem -LiteralPath $Destination -Filter $RequiredFile -File -Recurse -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if (-not $requiredPath) {
    $entries = (Get-ChildItem -LiteralPath $Destination -Force -ErrorAction SilentlyContinue |
      Select-Object -First 8 -ExpandProperty Name) -join ', '
    throw "The extracted archive did not contain $RequiredFile. Top-level entries: $entries. The selected download may be an installer or an unexpected release asset."
  }

  # Copy the archive contents from the executable's directory while preserving
  # subfolders, since Electron and llama.cpp ship supporting files beside it.
  $sourceDir = $requiredPath.Directory.FullName
  if (-not [string]::Equals($sourceDir, $Destination, [System.StringComparison]::OrdinalIgnoreCase)) {
    Get-ChildItem -LiteralPath $sourceDir -Force | ForEach-Object {
      Copy-Item -LiteralPath $_.FullName -Destination $Destination -Recurse -Force
    }
  }
}

  New-Item -ItemType Directory -Force -Path $Runtime, $ElectronDir, $LlamaDir, $ModelsDir | Out-Null

if (-not (Test-Path (Join-Path $ElectronDir 'electron.exe'))) {
  # Electron publishes several Windows ZIPs; the versioned electron-v... ZIP
  # contains electron.exe, while other similarly named archives may contain
  # symbols, headers, or debugging tools only.
  Get-ChildItem -LiteralPath $ElectronDir -Force -ErrorAction SilentlyContinue |
    Remove-Item -Recurse -Force
  $zip = Join-Path $Runtime 'electron.zip'
  try {
    Get-ReleaseAsset 'electron/electron' { param($name) $name -match '^electron-v\d+\.\d+\.\d+-win32-x64\.zip$' } $zip
    Expand-ReleaseArchive $zip $ElectronDir 'electron.exe'
  }
  finally {
    Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue
  }
}

if (-not (Test-Path (Join-Path $LlamaDir 'llama-server.exe'))) {
  $zip = Join-Path $Runtime 'llama.zip'
  try {
    # Current llama.cpp releases publish Windows CPU archives with varying
    # names. Prefer a clearly CPU-labelled x64 archive, then allow an x64
    # Windows archive without a GPU backend label.
    try {
      Get-ReleaseAsset 'ggml-org/llama.cpp' {
        param($name)
        $name -match '(?i)(win|windows).*(x64|amd64).*cpu.*\.zip$'
      } $zip
    }
    catch {
      if ($_.Exception.Message -notlike 'No matching release asset*') { throw }
      Get-ReleaseAsset 'ggml-org/llama.cpp' {
        param($name)
        $name -match '(?i)(win|windows).*(x64|amd64).*\.zip$' -and
          $name -notmatch '(?i)(cublas|cuda|vulkan|rocm|sycl|metal|hip|openvino|vulkan|clblast)'
      } $zip
    }
    Expand-ReleaseArchive $zip $LlamaDir 'llama-server.exe'
  }
  finally {
    Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue
  }
}

if (-not (Test-Path $ModelPath)) {
  $partialModel = "$ModelPath.download"
  Write-Host 'Downloading the Qwen2.5 1.5B Q4_K_M model (about 1.1 GB)...'
  try {
    Remove-Item -LiteralPath $partialModel -Force -ErrorAction SilentlyContinue
    Invoke-WebRequest -Uri 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf?download=true' -OutFile $partialModel
    Move-Item -LiteralPath $partialModel -Destination $ModelPath -Force
  }
  finally {
    Remove-Item -LiteralPath $partialModel -Force -ErrorAction SilentlyContinue
  }
}

  $free = [math]::Round((Get-PSDrive -Name (Split-Path -Qualifier $Root).TrimEnd(':')).Free / 1GB, 1)
  Write-Host "Setup complete. Free disk space: $free GB"
  Write-Host 'Run run.cmd to launch Offline Chat.'
}
catch {
  Write-Host ''
  Write-Host 'Setup failed:' -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host ''
  Write-Host 'Common fixes: allow PowerShell to run this local script, check internet access, and make sure this folder is writable.'
  Write-Host 'If Windows says access is denied, open PowerShell normally (not as administrator) and run setup.ps1 from this folder.'
  Write-Host ''
  try {
    [void](Read-Host 'Press Enter to close this window')
  }
  catch {
    # If launched without an interactive console, the error has still been printed.
  }
  exit 1
}
