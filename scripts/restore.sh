#!/usr/bin/env bash
set -Eeuo pipefail
APP_DIR="${OMS_APP_DIR:-/opt/open-motion-studio}"
ARCHIVE="${1:?usage: restore.sh /path/to/oms-backup.tgz}"
test -f "$ARCHIVE"
systemctl stop open-motion-studio.service
tar -xzf "$ARCHIVE" -C "$APP_DIR"
chown -R oms:oms "$APP_DIR/data"
systemctl start open-motion-studio.service
curl --fail --silent --show-error http://127.0.0.1:3216/health
