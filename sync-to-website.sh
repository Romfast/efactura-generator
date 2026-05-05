#!/usr/bin/env bash
# ============================================================================
# sync-to-website.sh
# ----------------------------------------------------------------------------
# Sync canonical efactura-generator -> romfast-website/efactura-generator
#
#   Source (canonic):  /workspace/efactura-generator/
#   Mirror în website: /workspace/romfast-website/efactura-generator/
#
# romfast-website e proiectul site-ului public (https://romfast.ro). Conține
# o oglindă a sub-app-ului efactura-generator care se publică la
# https://romfast.ro/efactura-generator/. Sursa de adevăr rămâne acest repo;
# editezi aici, apoi rulezi scriptul ca să propagi în website, apoi commit +
# rsync de deploy din /workspace/romfast-website/.
#
# Excluderi:
#  - metadata agenți / VCS / IDE
#  - artefacte locale (logs, temp, test, node_modules)
#  - secrete / config per-mediu (config.json e gestionat separat pe server)
#  - infra dev-only (Dockerfile, start.sh, web.config, .htaccess.template)
#  - documente interne (CLAUDE.md, DESIGN.md, TODO.md, docs/)
#  - sursa FoxPro (xmlefactura-preview.prg) și acest script
#  - info.php pe destinație (diagnostic prod, păstrat pe a2hosting)
#
# Folosire:
#   ./sync-to-website.sh           # sync, cu prompt înainte de schimbări
#   ./sync-to-website.sh --yes     # fără prompt (CI / agent non-interactiv)
#   ./sync-to-website.sh --dry-run # doar afișează ce s-ar schimba
# ============================================================================

set -euo pipefail

SRC="/workspace/efactura-generator/"
DST="/workspace/romfast-website/efactura-generator/"

EXCLUDES=(
  --exclude='.claude/'
  --exclude='.gstack/'
  --exclude='.playwright-mcp/'
  --exclude='.superdesign/'
  --exclude='.git/'
  --exclude='.gitignore'
  --exclude='logs/'
  --exclude='temp/'
  --exclude='test/'
  --exclude='node_modules/'
  --exclude='error_log'
  --exclude='config.json'
  --exclude='php.ini'
  --exclude='Dockerfile'
  --exclude='start.sh'
  --exclude='web.config'
  --exclude='.htaccess.template'
  --exclude='docs/'
  --exclude='TODO.md'
  --exclude='DESIGN.md'
  --exclude='CLAUDE.md'
  --exclude='xmlefactura-preview.prg'
  --exclude='sync-to-website.sh'
  --exclude='info.php'
)

mode="confirm"
for arg in "$@"; do
  case "$arg" in
    --yes|-y)     mode="yes" ;;
    --dry-run|-n) mode="dry"  ;;
    -h|--help)
      sed -n '2,30p' "$0"
      exit 0
      ;;
    *)
      echo "Argument necunoscut: $arg" >&2
      exit 2
      ;;
  esac
done

if [[ ! -d "$SRC" ]]; then
  echo "Source missing: $SRC" >&2
  exit 1
fi
if [[ ! -d "$DST" ]]; then
  echo "Destination missing: $DST" >&2
  echo "Cloneaza intai romfast-website: git clone git@gitea.romfast.ro:romfast/romfast-website.git /workspace/romfast-website" >&2
  exit 1
fi

echo "Dry-run: ce s-ar schimba"
echo "  src: $SRC"
echo "  dst: $DST"
echo "------------------------------------------------------------"
rsync -avn --delete --itemize-changes "${EXCLUDES[@]}" "$SRC" "$DST" \
  | grep -vE '^\.[/]?$|^sending|^sent |^total |^$' || true
echo "------------------------------------------------------------"

if [[ "$mode" == "dry" ]]; then
  exit 0
fi

if [[ "$mode" == "confirm" ]]; then
  read -r -p "Aplici schimbările? [y/N] " ans
  case "$ans" in
    y|Y|yes) ;;
    *) echo "Anulat."; exit 0 ;;
  esac
fi

rsync -av --delete "${EXCLUDES[@]}" "$SRC" "$DST"

echo
echo "Done. Pasul următor: deploy către a2hosting."
echo "  cd /workspace/romfast-website"
echo "  git status            # commit dacă vrei să țin istoricul"
echo "  # rsync de deploy: vezi /workspace/romfast-website/CLAUDE.md"
