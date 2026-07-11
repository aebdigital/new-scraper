#!/bin/bash
# Eagle Eye scraper daemon — runs the discovery/crawl/enrich/azet loops forever.
# Meant to be managed by launchd (com.eagleeye.scrapers) so it survives terminal /
# Claude-session teardown, logout, and reboot. Each loop has a crash guard: a batch
# that dies in under 30s triggers a 90s cooldown so a transient failure can't spin.
set -u
export PATH="/usr/local/bin:$PATH"
PROJ="/Users/alexanderhidveghy/Documents/eagle=eye"
cd "$PROJ" || exit 1
LOGDIR="$HOME/Library/Logs/eagle-eye"
mkdir -p "$LOGDIR"

# Keep the Mac awake (lid open + plugged in still required).
caffeinate -dimsu &

run_loop() {
  local name="$1"; shift
  local log="$LOGDIR/$name.log"
  while true; do
    echo "===== $name START $(date '+%F %T') =====" >>"$log"
    local s; s=$(date +%s)
    "$@" >>"$log" 2>&1
    local d=$(( $(date +%s) - s ))
    if [ "$d" -lt 30 ]; then
      echo "[GUARD] batch exited in ${d}s — cooldown 90s" >>"$log"
      sleep 90
    else
      sleep 5
    fi
  done
}

# azet runs three sub-commands per cycle (harvest -> profiles -> match).
run_azet() {
  local log="$LOGDIR/azet.log"
  while true; do
    echo "===== azet CYCLE $(date '+%F %T') =====" >>"$log"
    local s; s=$(date +%s)
    npx tsx src/scripts/bulk-directory-match.ts harvest  --max-pages 5000 --delay 1200 >>"$log" 2>&1
    npx tsx src/scripts/bulk-directory-match.ts profiles --limit 15000    --delay 1200 >>"$log" 2>&1
    npx tsx src/scripts/bulk-directory-match.ts match    --limit 80000 --concurrency 6 >>"$log" 2>&1
    local d=$(( $(date +%s) - s ))
    if [ "$d" -lt 30 ]; then
      echo "[GUARD] cycle exited in ${d}s — cooldown 90s" >>"$log"
      sleep 90
    else
      sleep 5
    fi
  done
}

run_loop discovery npx tsx src/scripts/discover-websites.ts --limit 25000 --delay 700 --concurrency 6 &
run_loop crawl     npx tsx src/scripts/run-crawl.ts --limit 20000 --concurrency 8 &
run_loop enrich    npx tsx src/scripts/enrich-contacts-from-websites.ts --limit 60000 &
run_azet &

wait
