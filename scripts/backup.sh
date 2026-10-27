#!/usr/bin/env bash
# Backup do PostgreSQL da Tako Store (OPS-002).
#
#   scripts/backup.sh                        # backups/tako-store-<data>.dump
#   scripts/backup.sh --out /caminho.dump
#   scripts/backup.sh --via docker           # força pg_dump dentro do contêiner (versão casa com o servidor)
#   scripts/backup.sh --via local            # força o pg_dump da máquina
#
# O dump é o formato custom (`pg_dump -Fc`): restaura com `pg_restore`, aceita `--clean` e permite restaurar uma
# tabela só. A senha nunca fica aqui: use PGPASSWORD no ambiente ou ~/.pgpass.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATABASE_URL="${DATABASE_URL:-postgres://tako:tako@localhost:5432/tako_store}"
OUT=""
KEEP=0
VIA="${TAKO_BACKUP_VIA:-auto}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out)
      OUT="$2"
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
    --keep)
      KEEP="$2"
      shift 2
      ;;
    *)
      echo "argumento desconhecido: $1" >&2
      exit 2
      ;;
  esac
done

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${OUT:-$ROOT/backups/tako-store-$STAMP.dump}"
mkdir -p "$(dirname "$OUT")"

# `pg_dump` precisa ser da mesma versão maior do servidor. Quando o banco é o contêiner do compose, o caminho
# confiável é usar o binário de dentro dele.
server_major="$(psql "$DATABASE_URL" -Atc "show server_version" 2>/dev/null | cut -d. -f1 || true)"
client_major="$(pg_dump --version 2>/dev/null | grep -oE '[0-9]+' | head -1 || true)"
if [[ "$VIA" == "auto" ]]; then
  if [[ -n "$server_major" && "$server_major" != "$client_major" ]] && docker compose ps postgres >/dev/null 2>&1; then
    VIA="docker"
  else
    VIA="local"
  fi
fi

echo "Backup de $DATABASE_URL → $OUT (via $VIA)"
if [[ "$VIA" == "docker" ]]; then
  db_name="${DATABASE_URL##*/}"
  db_user="$(psql "$DATABASE_URL" -Atc "select current_user")"
  docker compose exec -T postgres pg_dump --format=custom --no-owner --no-privileges -U "$db_user" "$db_name" > "$OUT"
else
  pg_dump --format=custom --no-owner --no-privileges --file "$OUT" "$DATABASE_URL"
fi

SIZE="$(wc -c < "$OUT" | tr -d ' ')"
echo "Concluído: $OUT ($SIZE bytes)"

# Retenção: mantém os N dumps mais recentes do diretório de destino (só os que seguem o padrão do script).
if [[ "$KEEP" -gt 0 ]]; then
  dir="$(dirname "$OUT")"
  mapfile -t dumps < <(ls -1t "$dir"/tako-store-*.dump 2>/dev/null || true)
  if [[ "${#dumps[@]}" -gt "$KEEP" ]]; then
    for old in "${dumps[@]:$KEEP}"; do
      echo "Removendo dump antigo: $old"
      rm -f "$old"
    done
  fi
fi
echo "Confira a integridade com: pg_restore --list \"$OUT\" | tail -5"
