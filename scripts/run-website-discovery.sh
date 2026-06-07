#!/bin/zsh

LOG_FILE="/Users/alexanderhidveghy/Documents/eagle=eye/logs/website-discovery.log"
PROJECT_DIR="/Users/alexanderhidveghy/Documents/eagle=eye"

exec >> "$LOG_FILE" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting website discovery"

cd "$PROJECT_DIR" || exit 1

exec /usr/local/bin/node \
  "$PROJECT_DIR/node_modules/tsx/dist/cli.mjs" \
  "$PROJECT_DIR/src/scripts/discover-websites.ts" \
  --limit 52000 \
  --delay 600
