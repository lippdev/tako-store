# Backup e restauração (OPS-002)

O procedimento, os comandos e o que foi medido na última prova.

## O que existe

| Peça | O que faz |
| :- | :- |
| `scripts/backup.sh` | `pg_dump` no formato custom, com data no nome, em `backups/`. |
| `scripts/restore.sh` | Cria um banco de destino (padrão `<banco>_restore`) e restaura o dump nele. |

O dump é formato custom (`-Fc`) porque permite `pg_restore --list`, restauração parcial e `--clean`. O `--no-owner`
e o `--no-privileges` deixam o dump independente de nome de papel, para restaurar em outra máquina sem surpresa.

## Versão do cliente

`pg_dump` só conversa com servidor da mesma versão maior. Quando o banco é o contêiner do compose e o cliente da
máquina é mais velho, o script usa o `pg_dump` de dentro do contêiner automaticamente (`--via docker`). Contra um
banco gerenciado, instale o cliente da versão do servidor e use `--via local`.

## Procedimento

```bash
# 1. Backup
PGPASSWORD=… ./scripts/backup.sh --out backups/antes-da-migracao.dump

# 2. Restauração em ambiente de teste (banco novo, sem tocar no de desenvolvimento)
PGPASSWORD=… ./scripts/restore.sh backups/antes-da-migracao.dump --database tako_store_restore --drop-existing

# 3. Aplicação contra o banco restaurado
DATABASE_URL=postgres://tako:tako@localhost:5432/tako_store_restore npm run dev

# 4. Conferência mínima
npm run typecheck && npm test
```

Restaurar por cima do banco da aplicação só com `--drop-existing`, e nunca durante a operação: o script recusa quando
o destino é o banco da `DATABASE_URL` sem essa flag.

## Prova (executada neste repositório)

```text
$ ./scripts/backup.sh --out /tmp/tako-backup.dump
Backup de postgres://tako:tako@localhost:5432/tako_store → /tmp/tako-backup.dump (via docker)
Concluído: /tmp/tako-backup.dump (65273 bytes)

$ ./scripts/restore.sh /tmp/tako-backup.dump --database tako_store_restore --drop-existing
Restaurado. Aponte a aplicação com DATABASE_URL=…/tako_store_restore para conferir as jornadas.

$ psql -d tako_store           -Atc "…"
12 jogos, 31 ofertas, 93 observações, 36 imagens, 5 fontes
$ psql -d tako_store_restore   -Atc "…"
12 jogos, 31 ofertas, 93 observações, 36 imagens, 5 fontes
```

## O que ainda falta para produção

- Rotina automática (cron do provedor ou serviço gerenciado) e retenção definida — a decisão de onde guardar o dump e
  por quanto tempo é de infraestrutura, não deste repositório.
- Backup de ponto no tempo (PITR) só existe em banco gerenciado com WAL arquivado; aqui a prova é o dump lógico.
- Ensaio de restauração periódico: restaurar e abrir a loja contra o banco restaurado. Sem ensaio, o backup é uma
  esperança.
