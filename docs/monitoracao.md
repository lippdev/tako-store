# Monitoramento e alertas (OPS-001)

O que precisa ser identificável, onde está o número e o que fazer quando ele passa do limite.

## Sinais

| Sinal | Onde aparece | Limite para agir |
| :- | :- | :- |
| API respondendo | `/api/health` devolve `status` | fora do ar ou `status: "down"` → incidente |
| Banco de dados | `database` no `/api/health` | `down` → incidente |
| Fonte falhando | `failingSources`, `sources[].consecutiveFailures` | 1 falha seguida → conferir; 3 → pausar a fonte |
| Erro de importação aberto | `openErrors`, painel Fontes | qualquer erro aberto → reprocessar ou corrigir o cadastro |
| Oferta vencida | `staleOffers`, painel Qualidade | preço mais velho que `max_age_hours` da fonte não aparece como atual |
| Última importação bem-sucedida | `lastSuccessfulRun` | mais de 2× a frequência da fonte → investigar a coleta |

## Como consultar

```bash
node scripts/healthcheck.mjs                              # usa http://localhost:5174
node scripts/healthcheck.mjs --url https://staging.exemplo  # contra outro ambiente
```

O script imprime o JSON do endpoint e sai com:

- `0` — `status: "ok"`;
- `1` — `status: "degraded"` (HTTP 503): há fonte falhando ou erro aberto;
- `2` — não conseguiu falar com o endpoint.

É esse código de saída que o monitor externo (cron, uptime, alerta do provedor) deve tratar como sinal.

## O que conta como degradado

`degraded` é proposital: erro de importação aberto não é "tudo certo". O endpoint responde **503** nesse caso para
que um monitor simples — que só olha o código HTTP — também perceba. `ok` só quando não há falha de fonte nem erro
aberto.

## Alertas recomendados

1. **Disponibilidade:** `GET /api/health` a cada minuto; alerte em duas falhas seguidas (evita falso positivo de deploy).
2. **Degradação:** alerte quando o código for 503 por mais de 30 minutos, ou quando `openErrors` subir em relação à
   leitura anterior.
3. **Estagnação:** alerte quando `lastSuccessfulRun` passar de `2 × cadence_hours` da fonte com `status: approved`.
4. **Volume:** alerte quando `accepted` de uma execução cair mais de 50% em relação à média das últimas execuções da
   mesma fonte — costuma anteceder fonte quebrada.

O painel **Qualidade** mostra a mesma informação para quem está operando: fonte, última execução, falhas seguidas e
erros abertos, com link para a tela que resolve.
