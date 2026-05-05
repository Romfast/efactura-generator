#!/usr/bin/env bash
# ============================================================================
# sync-to-website.sh
# ----------------------------------------------------------------------------
# Propagă modificările din repo-ul canonic efactura-generator în două ținte:
#
#   1. Mirror local în romfast-website (default)
#      /workspace/efactura-generator/  ->  /workspace/romfast-website/efactura-generator/
#
#   2. Producție pe a2hosting (cu --deploy)
#      /workspace/efactura-generator/  ->  romfastr@nl1-ss18.a2hosting.com:~/public_html/efactura-generator/
#
# Workflow tipic:
#   - editezi în repo-ul canonic
#   - ./sync-to-website.sh             # actualizezi mirror-ul (commit acolo manual)
#   - ./sync-to-website.sh --deploy    # mirror + deploy direct pe prod
#
# Pe prod, `config.json` e exclus mereu (conține `api_key` și e gestionat
# direct pe server, nu prin sync). Vezi excluderile în EXCLUDES.
#
# Folosire:
#   ./sync-to-website.sh                 # mirror local, cu prompt
#   ./sync-to-website.sh --yes           # mirror local, fără prompt
#   ./sync-to-website.sh --dry-run       # doar previzualizează mirror local
#   ./sync-to-website.sh --deploy        # mirror local + deploy pe prod, cu prompt
#   ./sync-to-website.sh --deploy --yes  # mirror local + deploy pe prod, fără prompt
#   ./sync-to-website.sh --deploy-only   # SARI peste mirror, deploy direct canonic -> prod
#   ./sync-to-website.sh --deploy --dry-run  # previzualizează ambele faze
# ============================================================================

set -euo pipefail

# --- Surse / Destinații -----------------------------------------------------
SRC="/workspace/efactura-generator/"
MIRROR="/workspace/romfast-website/efactura-generator/"

PROD_HOST="nl1-ss18.a2hosting.com"
PROD_PORT="7822"
PROD_USER="romfastr"
PROD_PATH="public_html/efactura-generator/"   # relativ la home, deci fără ~ literal
PROD_SSH_KEY="${HOME}/.ssh/id_ed25519"

# --- Excluderi (aceleași pentru mirror și deploy) ---------------------------
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
do_mirror="yes"
do_deploy="no"

for arg in "$@"; do
  case "$arg" in
    --yes|-y)        mode="yes" ;;
    --dry-run|-n)    mode="dry" ;;
    --deploy)        do_deploy="yes" ;;
    --deploy-only)   do_deploy="yes"; do_mirror="no" ;;
    -h|--help)
      sed -n '2,32p' "$0"
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

if [[ "$do_mirror" == "yes" && ! -d "$MIRROR" ]]; then
  echo "Mirror missing: $MIRROR" >&2
  echo "Cloneaza intai romfast-website:" >&2
  echo "  git clone git@gitea.romfast.ro:romfast/romfast-website.git /workspace/romfast-website" >&2
  exit 1
fi

# --- Helpers ----------------------------------------------------------------
ssh_cmd="ssh -p ${PROD_PORT} -i ${PROD_SSH_KEY} -o IdentitiesOnly=yes"

filter_dry_output() {
  grep -vE '^\.[/]?$|^sending|^sent |^total |^$' || true
}

# --- Fază 1: mirror local ---------------------------------------------------
if [[ "$do_mirror" == "yes" ]]; then
  echo "============================================================"
  echo "Fază 1/2: mirror local"
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
    echo "Mirror local actualizat."
  fi
fi

# --- Fază 2: deploy prod ----------------------------------------------------
if [[ "$do_deploy" == "yes" ]]; then
  echo
  echo "============================================================"
  echo "Fază 2/2: deploy producție"
  echo "  src: $SRC"
  echo "  dst: ${PROD_USER}@${PROD_HOST}:${PROD_PATH}"
  echo "------------------------------------------------------------"

  # Verifică conectivitatea SSH înainte să încerce rsync
  if ! $ssh_cmd -o ConnectTimeout=10 "${PROD_USER}@${PROD_HOST}" "test -d ${PROD_PATH}" 2>/dev/null; then
    echo "Eroare: nu pot conecta SSH la ${PROD_USER}@${PROD_HOST}:${PROD_PORT} sau ${PROD_PATH} nu există." >&2
    echo "Verifică ${PROD_SSH_KEY} și autorizarea cheii pe server." >&2
    exit 3
  fi

  rsync -avzn --delete --itemize-changes \
    -e "$ssh_cmd" \
    "${EXCLUDES[@]}" \
    "$SRC" "${PROD_USER}@${PROD_HOST}:${PROD_PATH}" | filter_dry_output

  if [[ "$mode" != "dry" ]]; then
    if [[ "$mode" == "confirm" ]]; then
      echo
      read -r -p "Aplici deploy pe prod? [y/N] " ans
      case "$ans" in
        y|Y|yes) ;;
        *) echo "Deploy anulat."; exit 0 ;;
      esac
    fi
    rsync -avz --delete \
      -e "$ssh_cmd" \
      "${EXCLUDES[@]}" \
      "$SRC" "${PROD_USER}@${PROD_HOST}:${PROD_PATH}"
    echo
    echo "Deploy aplicat. Verificare:"
    echo "  curl -sS 'https://romfast.ro/efactura-generator/receiver.php?action=ping'"
  fi
fi

if [[ "$mode" == "dry" ]]; then
  echo
  echo "Dry-run terminat. Nicio schimbare aplicată."
fi
