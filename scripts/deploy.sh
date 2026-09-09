#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${OMS_APP_DIR:-/opt/open-motion-studio}"
SERVICE="open-motion-studio.service"

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "Missing Git checkout: $APP_DIR" >&2
  exit 1
fi

cd "$APP_DIR"
git fetch --quiet origin main
target="$(git rev-parse origin/main)"
git merge --ff-only "$target"
npm ci
npm run test
npm run typecheck
npm run build
install -d -o oms -g oms "$APP_DIR/data"
systemctl daemon-reload
systemctl restart "$SERVICE"
curl --fail --silent --show-error --retry 10 --retry-delay 1 http://127.0.0.1:3216/health
echo "Deployed $target"
