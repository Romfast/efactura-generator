#!/usr/bin/env bash
# ============================================================================
# sync-to-website.sh
# ----------------------------------------------------------------------------
# Propagă modificările din repo-ul canonic efactura-generator în mirror-ul din romfast-website:
#   /workspace/efactura-generator/  ->  /workspace/romfast-website/efactura-generator/
#
# Workflow tipic:
#   - editezi în repo-ul canonic
#   - ./sync-to-website.sh             # actualizezi mirror-ul (commit acolo manual)
#   - în romfast-website: ./deploy.sh  # deploy pe prod (romarg.ro, rclone pe FTPS)
#
# --deploy / --deploy-only sunt DEZACTIVATE: găzduirea s-a mutat de pe a2hosting
# pe romarg.ro, care nu are SSH (rsync imposibil). Deploy-ul se face doar din romfast-website.
#
# `config.json` e exclus mereu (conține `api_key` și e gestionat direct pe server,
# nu prin sync). Vezi excluderile în EXCLUDES.
#
# Folosire:
#   ./sync-to-website.sh                 # mirror local, cu prompt
#   ./sync-to-website.sh --yes           # mirror local, fără prompt
#   ./sync-to-website.sh --dry-run       # doar previzualizează mirror local
# ============================================================================

set -euo pipefail

# --- Surse / Destinații -----------------------------------------------------
SRC="/workspace/efactura-generator/"
MIRROR="/workspace/romfast-website/efactura-generator/"

# --- Excluderi --------------------------------------------------------------
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

# --- Parsare argumente ------------------------------------------------------
mode="confirm"   # confirm | yes | dry

for arg in "$@"; do
  case "$arg" in
    --yes|-y)        mode="yes" ;;
    --dry-run|-n)    mode="dry" ;;
    --deploy|--deploy-only)
      echo "Eroare: $arg e dezactivat — prod s-a mutat pe romarg.ro (fără SSH, rsync imposibil)." >&2
      echo "Rulează ./sync-to-website.sh (mirror), commit în romfast-website, apoi ./deploy.sh de acolo." >&2
      exit 2
      ;;
    -h|--help)
      sed -n '2,25p' "$0"
      exit 0
      ;;
    *)
      echo "Argument necunoscut: $arg" >&2
      exit 2
      ;;
  esac
done

# --- Validări sursă ---------------------------------------------------------
if [[ ! -d "$SRC" ]]; then
  echo "Source missing: $SRC" >&2
  exit 1
fi

if [[ ! -d "$MIRROR" ]]; then
  echo "Mirror missing: $MIRROR" >&2
  echo "Cloneaza intai romfast-website:" >&2
  echo "  git clone git@gitea.romfast.ro:romfast/romfast-website.git /workspace/romfast-website" >&2
  exit 1
fi

# --- Helpers ----------------------------------------------------------------
filter_dry_output() {
  grep -vE '^\.[/]?$|^sending|^sent |^total |^$' || true
}

# --- Mirror local -----------------------------------------------------------
echo "============================================================"
echo "Mirror local"
echo "  src: $SRC"
echo "  dst: $MIRROR"
echo "------------------------------------------------------------"
rsync -avn --delete --itemize-changes "${EXCLUDES[@]}" "$SRC" "$MIRROR" | filter_dry_output

if [[ "$mode" != "dry" ]]; then
  if [[ "$mode" == "confirm" ]]; then
    read -r -p "Aplici mirror local? [y/N] " ans
    case "$ans" in
      y|Y|yes) ;;
      *) echo "Mirror anulat. Abort."; exit 0 ;;
    esac
  fi
  rsync -av --delete "${EXCLUDES[@]}" "$SRC" "$MIRROR"
  echo "Mirror local actualizat. Urmează: commit în romfast-website, apoi ./deploy.sh."
fi

if [[ "$mode" == "dry" ]]; then
  echo
  echo "Dry-run terminat. Nicio schimbare aplicată."
fi
