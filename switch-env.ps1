#!/usr/bin/env pwsh
# Switch between dev and prod Supabase databases locally

param(
    [ValidateSet('dev', 'prod')]
    [string]$Environment = 'dev'
)

$envFile = ".env.local.$Environment"
$targetFile = ".env.local"

if (-not (Test-Path $envFile)) {
    Write-Error "Environment file not found: $envFile"
    exit 1
}

Copy-Item $envFile $targetFile -Force
Write-Host "Switched to $Environment environment" -ForegroundColor Green
Write-Host ".env.local updated from $envFile"

# Also switch Supabase CLI context if needed
if ($Environment -eq 'dev') {
    Write-Host "To reset dev database: yarn supabase db reset --linked --yes" -ForegroundColor Cyan
} else {
    Write-Host "To reset prod database: yarn supabase db reset --linked --yes" -ForegroundColor Cyan
}
