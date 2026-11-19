#!/usr/bin/env bash
# Ruleaza TOATA suita (pagini browser + functional + vizual). Iese nenul la orice esec.
# Folosire din radacina repo: bash test/run.sh [argumente playwright, ex: --grep catalog]
set -u
cd "$(dirname "$0")/e2e" || exit 1
if [ ! -d node_modules ]; then npm install || exit 1; npx playwright install chromium || exit 1; fi
npx playwright test --project=local --project=visual "$@"
code=$?
node scripts/contact-sheet.mjs
exit $code
