#!/usr/bin/env pwsh
# push.ps1 — Quick commit & push helper for ZePlay
# Usage: .\push.ps1 "your commit message"

param(
    [Parameter(Mandatory = $true)]
    [string]$Message
)

Set-Location "e:\WEBS & APPS\ZePlay"

git add -A
$status = git status --short
if (-not $status) {
    Write-Host "Nothing to commit. Working tree clean." -ForegroundColor Yellow
    exit 0
}

git commit -m $Message
git push origin master

Write-Host "`n✅ Pushed to https://github.com/syedasjadabbas/ZePlay" -ForegroundColor Green
