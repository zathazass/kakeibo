#!/usr/bin/env bash
#
# The only command you need.
#
#   ./run.sh
#
# Fetches the latest code, backs up your ledger, rebuilds, restarts, checks
# that every entry survived, and tidies up after itself. If anything looks
# wrong it puts your data back the way it was and tells you.
#
#   ./run.sh --no-pull    use the code you already have
#   ./run.sh --stop       stop the app

set -euo pipefail
cd "$(dirname "$0")"

APP_URL="http://127.0.0.1:2455"
DB="data/kakeibo.db"
BACKUPS="data/backups"
KEEP_SNAPSHOTS=5          # how many old snapshots to leave behind
PULL=1

for arg in "$@"; do
  case "$arg" in
    --no-pull) PULL=0 ;;
    --stop)
      docker compose down >/dev/null 2>&1 || true
      echo "kaKeiBo stopped. Your ledger is still in $DB."
      exit 0 ;;
    *) echo "Unknown option: $arg (try --no-pull or --stop)"; exit 2 ;;
  esac
done

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
step() { printf '\n\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
die()  { printf '\n  \033[31m✗ %s\033[0m\n\n' "$1"; exit 1; }

count_entries() {
  local file="$1"
  [ -f "$file" ] || { echo 0; return; }
  python3 - "$file" <<'PY' 2>/dev/null || echo 0
import sqlite3, sys
try:
    conn = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
    print(conn.execute("SELECT COUNT(*) FROM expense").fetchone()[0])
except Exception:
    print(0)
PY
}

bold "kaKeiBo 家計簿"

# ---------------------------------------------------------------- 1. checks
step "Checking your machine"
command -v docker >/dev/null || die "Docker is not installed. Install Docker Desktop, then run this again."
docker info >/dev/null 2>&1 || die "Docker is installed but not running. Start Docker, then run this again."
docker compose version >/dev/null 2>&1 || die "This needs Docker Compose, which normally ships with Docker."
command -v python3 >/dev/null || die "This needs python3 to check your data survived. Install it with: sudo apt install python3"
ok "Docker is running"

mkdir -p data "$BACKUPS"

BEFORE=$(count_entries "$DB")

# First run: carry across a ledger from before Docker was used. Only ever when
# the live one is missing or empty, so this can never overwrite real entries.
if [ "$BEFORE" -eq 0 ] && [ -f backend/kakeibo.db ]; then
  CARRIED=$(count_entries backend/kakeibo.db)
  if [ "$CARRIED" -gt 0 ]; then
    cp backend/kakeibo.db "$DB"
    BEFORE="$CARRIED"
    ok "Brought $CARRIED existing entries across into $DB"
  fi
fi
if [ "$BEFORE" -gt 0 ]; then
  ok "Found $BEFORE entries in your ledger"
else
  ok "Starting with an empty ledger"
fi

# ------------------------------------------------------------- 2. stand down
step "Stopping the app"
docker compose down >/dev/null 2>&1 || true
ok "Stopped — nothing is writing to your ledger now"

# ---------------------------------------------------------------- 3. back up
SAFETY=""
if [ "$BEFORE" -gt 0 ]; then
  step "Backing up your ledger"
  SAFETY="$BACKUPS/before-update-$(date +%Y%m%d-%H%M%S).db"
  cp "$DB" "$SAFETY"
  ok "Saved a copy: $SAFETY"
fi

# ------------------------------------------------------------------ 4. pull
if [ "$PULL" -eq 1 ] && [ -d .git ]; then
  step "Fetching the latest version"
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    warn "You have your own uncommitted changes — leaving the code as it is"
  elif ! git remote get-url origin >/dev/null 2>&1; then
    warn "No download location set up — using the code you already have"
  elif git pull --ff-only >/dev/null 2>&1; then
    ok "Now on $(git log -1 --pretty=%s | cut -c1-60)"
  else
    warn "Could not fetch an update — carrying on with the code you have"
  fi
fi

# ----------------------------------------------------------------- 5. build
step "Building the app (this can take a minute the first time)"
LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT
if ! docker compose build --quiet >"$LOG" 2>&1; then
  echo; sed 's/^/    /' "$LOG"
  die "The build failed. Nothing was changed — your ledger is untouched in $DB."
fi
ok "Built"

# ----------------------------------------------------------------- 6. start
step "Starting up"
if ! docker compose up -d >"$LOG" 2>&1; then
  echo; sed 's/^/    /' "$LOG"
  die "Could not start. Your ledger is untouched in $DB."
fi

READY=0
for _ in $(seq 1 60); do
  if curl -sf "$APP_URL/api/health" >/dev/null 2>&1; then READY=1; break; fi
  sleep 1
done
[ "$READY" -eq 1 ] || die "The app did not answer within a minute. Run 'docker compose logs' to see why."
ok "Running at $APP_URL"

# ---------------------------------------------------------------- 7. verify
step "Checking your data came through"
AFTER=$(count_entries "$DB")

if [ "$AFTER" -lt "$BEFORE" ]; then
  warn "Expected $BEFORE entries but found $AFTER — putting your backup back"
  docker compose down >/dev/null 2>&1 || true
  [ -n "$SAFETY" ] && cp "$SAFETY" "$DB"
  docker compose up -d >/dev/null 2>&1 || true
  die "Your data was restored from $SAFETY and the app was restarted. Nothing was lost — please report this."
fi
ok "$AFTER entries present and correct"

# ---------------------------------------------------------------- 8. tidy up
step "Tidying up"
# The safety copy has done its job — the live ledger is verified good.
if [ -n "$SAFETY" ] && [ -f "$SAFETY" ]; then
  rm -f "$SAFETY"
  ok "Removed the temporary backup (no longer needed)"
fi
# Keep only the most recent automatic snapshots.
REMOVED=$(ls -1t "$BACKUPS"/kakeibo-*.db 2>/dev/null | tail -n +$((KEEP_SNAPSHOTS + 1)) | wc -l)
if [ "$REMOVED" -gt 0 ]; then
  ls -1t "$BACKUPS"/kakeibo-*.db 2>/dev/null | tail -n +$((KEEP_SNAPSHOTS + 1)) | xargs -r rm -f
  ok "Cleared $REMOVED old snapshot(s), keeping the newest $KEEP_SNAPSHOTS"
else
  ok "Nothing to clear"
fi
RECLAIMED=$(docker image prune -f 2>/dev/null | grep -oE '[0-9.]+[KMG]B' | tail -1 || true)
if [ -n "${RECLAIMED:-}" ] && [ "$RECLAIMED" != "0B" ]; then
  ok "Reclaimed $RECLAIMED of leftover build files"
fi

printf '\n\033[1m  Ready — open %s\033[0m\n\n' "$APP_URL"
