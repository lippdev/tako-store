#!/usr/bin/env bash
# Restauração do backup da Tako Store (OPS-002). O padrão é restaurar num banco novo — provar que o backup presta
# antes de precisar dele. Restaurar por cima do banco da aplicação exige --drop-existing.
#
#   scripts/restore.sh backups/arquivo.dump
#   scripts/restore.sh backups/arquivo.dump --database tako_store_restore --drop-existing
#   scripts/restore.sh backups/arquivo.dump --via docker
#
# Depois de restaurar, aponte DATABASE_URL para o banco restaurado, rode `npm run typecheck && npm test` e abra a
# loja: as jornadas precisam funcionar com os dados do backup.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATABASE_URL="${DATABASE_URL:-postgres://tako:tako@localhost:5432/tako_store}"
FILE=""
TARGET_DB=""
DROP_EXISTING=0
VIA="${TAKO_RESTORE_VIA:-auto}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --database)
      TARGET_DB="$2"
      shift 2
      ;;
    --database-url)
      DATABASE_URL="$2"
      shift 2
      ;;
    --via)
      VIA="$2"
      shift 2
      ;;
    --drop-existing)
      DROP_EXISTING=1
      shift
      ;;
    *)
      FILE="$1"
      shift
      ;;
  esac
done

if [[ -z "$FILE" ]]; then
  echo "uso: scripts/restore.sh <arquivo.dump> [--database nome] [--drop-existing] [--via docker|local]" >&2
  exit 2
fi
if [[ ! -f "$FILE" ]]; then
  echo "arquivo não encontrado: $FILE" >&2
  exit 2
fi

BASE_URL="${DATABASE_URL%/*}"
CURRENT_DB="${DATABASE_URL##*/}"
TARGET_DB="${TARGET_DB:-${CURRENT_DB}_restore}"

if [[ "$TARGET_DB" == "$CURRENT_DB" && "$DROP_EXISTING" -eq 0 ]]; then
  echo "recusado: o banco de destino é o mesmo da aplicação ($CURRENT_DB). Use --database outro_nome." >&2
  exit 3
fi

server_major="$(psql "$DATABASE_URL" -Atc "show server_version" 2>/dev/null | cut -d. -f1 || true)"
client_major="$(pg_restore --version 2>/dev/null | grep -oE '[0-9]+' | head -1 || true)"
if [[ "$VIA" == "auto" ]]; then
  if [[ -n "$server_major" && "$server_major" != "$client_major" ]] && docker compose ps postgres >/dev/null 2>&1; then
    VIA="docker"
  else
    VIA="local"
  fi
fi

echo "Restaurando $FILE em ${BASE_URL}/${TARGET_DB} (via $VIA)"
if [[ "$VIA" == "docker" ]]; then
  admin_user="$(psql "$DATABASE_URL" -Atc "select current_user")"
  if [[ "$DROP_EXISTING" -eq 1 ]]; then
    docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$admin_user" -d postgres -c "drop database if exists \"$TARGET_DB\""
  fi
  docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$admin_user" -d postgres -c "create database \"$TARGET_DB\""
  docker compose exec -T postgres pg_restore --no-owner --no-privileges --exit-on-error -U "$admin_user" -d "$TARGET_DB" < "$FILE"
else
  if [[ "$DROP_EXISTING" -eq 1 ]]; then
    psql "$BASE_URL/postgres" -v ON_ERROR_STOP=1 -c "drop database if exists \"$TARGET_DB\""
  fi
  psql "$BASE_URL/postgres" -v ON_ERROR_STOP=1 -c "create database \"$TARGET_DB\""
  pg_restore --no-owner --no-privileges --exit-on-error --dbname "${BASE_URL}/${TARGET_DB}" "$FILE"
fi

echo "Restaurado. Aponte a aplicação com DATABASE_URL=${BASE_URL}/${TARGET_DB} para conferir as jornadas."
