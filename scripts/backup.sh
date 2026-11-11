#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p backups
docker compose exec -T db pg_dump -U lekafit -Fc lekafit > "backups/lekafit-$(date +%F).dump"
find backups -name 'lekafit-*.dump' -mtime +30 -delete
