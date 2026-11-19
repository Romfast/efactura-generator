# Ruleaza TOATA suita (pagini browser + functional + vizual). Iese nenul la orice esec.
# Folosire din radacina repo: powershell -ExecutionPolicy Bypass -File test\run.ps1 [argumente playwright]
$ErrorActionPreference = 'Continue'
Push-Location (Join-Path $PSScriptRoot 'e2e')
try {
  if (-not (Test-Path node_modules)) {
    npm install; if ($LASTEXITCODE -ne 0) { exit 1 }
    npx playwright install chromium; if ($LASTEXITCODE -ne 0) { exit 1 }
  }
  npx playwright test --project=local --project=visual @args
  $code = $LASTEXITCODE
  node scripts/contact-sheet.mjs
  exit $code
} finally { Pop-Location }
