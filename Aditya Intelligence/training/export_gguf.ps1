[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$MergedModel, [Parameter(Mandatory=$true)][string]$LlamaSource)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path "$LlamaSource\convert_hf_to_gguf.py")) { throw 'LlamaSource must be a llama.cpp source checkout.' }
$python = Get-Command python -ErrorAction Stop
$output = Join-Path (Split-Path $MergedModel -Parent) 'aditya-f16.gguf'
& $python.Source "$LlamaSource\convert_hf_to_gguf.py" $MergedModel --outtype f16 --outfile $output
$quantizer = Get-ChildItem "$LlamaSource\build\bin\llama-quantize*" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $quantizer) { throw 'Build llama.cpp first so llama-quantize exists under build\bin.' }
& $quantizer.FullName $output (Join-Path (Split-Path $MergedModel -Parent) 'aditya-q4_k_m.gguf') Q4_K_M
