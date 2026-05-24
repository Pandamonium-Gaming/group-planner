#!/usr/bin/env pwsh
# Sync production data into dev using data-only dump/restore.
# Can use either:
#   1) DATABASE_URL with psql (requires PostgreSQL client tools)
#   2) SUPABASE_PROJECT_REF with Supabase CLI

param(
  [string]$DumpFile = ".tmp/prod-data.sql",
  [switch]$ResetDev,
  [switch]$UsePsql  # Force psql method if available
)

$ErrorActionPreference = "Stop"

function Import-EnvFile {
  param([string]$Path)
  if (-not (Test-Path $Path)) {
    throw "Env file not found: $Path"
  }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $parts = $line -split '=', 2
    if ($parts.Count -ne 2) { return }
    $name = $parts[0].Trim()
    $value = $parts[1].Trim().Trim('"')
    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

# 1) Load prod env and dump data
Write-Host "Loading prod environment..." -ForegroundColor Cyan
Import-EnvFile ".env.local.prod"

$prodDbUrl = [Environment]::GetEnvironmentVariable("DATABASE_URL", "Process")

$dumpDir = Split-Path $DumpFile -Parent
if ($dumpDir -and -not (Test-Path $dumpDir)) {
  New-Item -ItemType Directory -Path $dumpDir | Out-Null
}

Write-Host "Dumping prod data to $DumpFile..." -ForegroundColor Cyan

# Always use pg_dump directly - NEVER use supabase CLI --linked as it uses the currently linked project,
# not the environment we just loaded. This prevents dumping from the wrong database.
if (-not ($prodDbUrl -and $prodDbUrl -notmatch '\[YOUR-PASSWORD\]')) {
  throw "DATABASE_URL not configured or invalid in .env.local.prod"
}

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  throw "pg_dump not found. Install PostgreSQL client tools."
}

pg_dump $prodDbUrl --data-only | Out-File -FilePath $DumpFile -Encoding utf8

# 2) Load dev env and restore
Write-Host "Loading dev environment..." -ForegroundColor Cyan
Import-EnvFile ".env.local.dev"

$devDbUrl = [Environment]::GetEnvironmentVariable("DATABASE_URL", "Process")

if ($ResetDev) {
  Write-Host "Resetting dev database..." -ForegroundColor Yellow
  # Use supabase CLI to reset - this applies all migrations
  if (-not (Get-Command yarn -ErrorAction SilentlyContinue)) {
    throw "yarn not found. Install Yarn"
  }
  yarn supabase db reset --linked --yes
}

Write-Host "Restoring data into dev..." -ForegroundColor Cyan

if (-not ($devDbUrl -and $devDbUrl -notmatch '\[YOUR-PASSWORD\]')) {
  throw "DATABASE_URL not configured or invalid in .env.local.dev"
}

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  throw "psql not found. Install PostgreSQL client tools."
}

psql $devDbUrl -f $DumpFile

Write-Host "Data sync complete." -ForegroundColor Green
