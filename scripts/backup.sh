#!/usr/bin/env bash
set -Eeuo pipefail
APP_DIR="${OMS_APP_DIR:-/opt/open-motion-studio}"
BACKUP_DIR="${OMS_BACKUP_DIR:-/var/backups/open-motion-studio}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
install -d -m 0750 "$BACKUP_DIR"
tar --exclude='node_modules' --exclude='dist' -czf "$BACKUP_DIR/oms-$stamp.tgz" -C "$APP_DIR" data .env 2>/dev/null || tar --exclude='node_modules' --exclude='dist' -czf "$BACKUP_DIR/oms-$stamp.tgz" -C "$APP_DIR" data
echo "$BACKUP_DIR/oms-$stamp.tgz"
