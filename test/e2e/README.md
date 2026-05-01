# Suite E2E Playwright — efactura-generator

## Setup (o singură dată)

```bash
cd test/e2e
npm install
npx playwright install chromium
```

## Rulare

```bash
# Smoke local (rapid)
npx playwright test --project=local --grep smoke

# Full local (toate spec-urile)
npx playwright test --project=local

# Prod efactura.roa (cif lookup va fi test.fail — bug 403 cunoscut)
npx playwright test --project=prod-roa

# Prod romfast.ro
npx playwright test --project=prod-romfast

# HTML report
npx playwright show-report
```

## Environments

| Project | URL |
|---------|-----|
| local | http://localhost:3000 |
| prod-roa | https://efactura.roa.romfast.ro |
| prod-romfast | https://romfast.ro/efactura-generator |

## Note

- `receiver.spec.ts` folosește `RECEIVER_URL` env var (default: `http://localhost:8000`)
- Pe `prod-roa`, testul `cif lookup` este marcat `test.fail` — bug 403 cunoscut (IP gate în receiver.php blochează proxy Traefik)
- `regression-corpus.spec.ts` rulează doar pe `local` (wrap peste `test/regression.html`)
