# Suita E2E Playwright — efactura-generator

Ghid complet: `../README.md`. Acoperire UI: `COVERAGE.md`.

```bash
npm install && npx playwright install chromium   # o singura data
npm test                    # local (functional + pagini browser) + visual
npm run test:functional     # doar functional
npm run test:visual         # doar vizual (npm run test:visual:update pentru baseline-uri)
npm run smoke:live          # post-deploy, doar citire (LIVE_URL)
npm run report              # raport HTML
```

Porturi: `E2E_PORT` (3917), `E2E_PHP_PORT` (8917). Proiectele `prod-*` nu fac parte din `npm test`.
