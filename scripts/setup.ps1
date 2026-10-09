$ErrorActionPreference = 'Stop'
Write-Host 'RSCDS local setup (PowerShell)'
if (-not (Get-Command py -ErrorAction SilentlyContinue)) { throw 'Install Python 3.11+' }
py scripts/setup.py
