#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\n' 'Open Motion Studio preflight'
for tool in git node npm ffmpeg; do
  if ! command -v "$tool" >/dev/null; then echo "MISSING $tool"; exit 1; fi
  printf '%-10s %s\n' "$tool" "$($tool --version 2>/dev/null | head -1)"
done
printf '%-10s %s\n' 'nginx' "$(command -v nginx || echo 'not installed')"
printf '%-10s %s\n' 'docker' "$(command -v docker || echo 'not installed')"
printf '%-10s %s\n' 'supabase' "$(command -v supabase || echo 'not installed; use MCP or documented remote CLI')"
printf '%s\n' '--- resources ---'
df -h . | tail -1
free -h | sed -n '2p'
printf '%s\n' '--- firewall ---'
if command -v ufw >/dev/null; then ufw status | head -5; else echo 'ufw not installed'; fi
printf '%s\n' '--- port ---'
if ss -ltn "sport = :3216" 2>/dev/null | tail -n +2 | grep -q .; then echo '3216 is occupied; set OMS_PORT before starting'; else echo '3216 is available'; fi
