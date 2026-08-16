$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
  throw 'Python launcher "py" was not found. Install 64-bit Python 3.11 from python.org and enable the Python launcher.'
}

& py -3.11 -c "import sys; assert sys.maxsize > 2**32; print(sys.version)"
if ($LASTEXITCODE -ne 0) {
  throw 'WISDO requires 64-bit Python 3.11 on Windows because PocketSphinx 5.1.1 does not publish a Python 3.12 Windows wheel. Install Python 3.11, then run this installer again.'
}

if (-not (Test-Path '.venv311\Scripts\python.exe')) {
  & py -3.11 -m venv .venv311
  if ($LASTEXITCODE -ne 0) { throw 'Could not create the WISDO Python 3.11 environment.' }
}

& .\.venv311\Scripts\python.exe -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw 'Could not upgrade pip in the WISDO environment.' }

# Refuse source builds on Windows. A source build requires Visual Studio/NMake
# and caused the misleading partial installation seen with Python 3.12.
& .\.venv311\Scripts\python.exe -m pip install --only-binary=:all: pocketsphinx==5.1.1
if ($LASTEXITCODE -ne 0) { throw 'The PocketSphinx Windows wheel could not be installed.' }

& .\.venv311\Scripts\python.exe -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { throw 'WISDO Python dependency installation failed.' }

& .\.venv311\Scripts\python.exe -c "import pyaudio, pocketsphinx, requests, speech_recognition; print('WISDO audio dependencies verified.')"
if ($LASTEXITCODE -ne 0) { throw 'WISDO installed packages but the audio dependency verification failed.' }

New-Item -ItemType Directory -Force -Path data | Out-Null
if (-not (Test-Path '.env')) {
  Copy-Item 'windows-env.example' '.env'
}

Write-Host ''
Write-Host 'WISDO Windows Voice installed.' -ForegroundColor Green
Write-Host '1. Open pi-edge\.env and enter the cloud URL, device ID, and enrollment code.'
Write-Host '2. Run enroll-windows.cmd once.'
Write-Host '3. Run start-wisdo-windows.cmd.'
