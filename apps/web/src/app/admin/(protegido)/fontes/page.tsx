import { listIngestionErrorsDetailed, listIngestionRuns, listSources, runsWithOpenErrors } from "@tako/db";
import { SOURCE_ACCESS_LABELS, SOURCE_STATUS_LABELS, sourceIsUsable, type SourceAccess, type SourceStatus } from "@tako/domain";
import {
  alternarFonte,
  desativarOfertasDaFonte,
  executarImportacao,
  reprocessarExecucao,
  salvarFonte,
  salvarMatrizFonte,
} from "../../actions";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

/** Fontes e integrações: pausar, executar, ver execuções, reprocessar erros e a matriz de candidatas (PAR-004). */
/** Host do feed, sem expor o token que costuma vir na URL. */
function feedHost(url: string | null): string {
  if (url === null || url.trim() === "") return "sem feed configurado";
  try {
    return `feed em ${new URL(url).hostname}`;
  } catch {
    return "feed com endereço inválido";
  }
}

export default async function FontesPage({
  searchParams,
}: {
  searchParams: Promise<{
    ok?: string;
    desativadas?: string;
    erro?: string;
    resolvidos?: string;
    tentados?: string;
    aceitas?: string;
    recusadas?: string;
    detalhe?: string;
  }>;
}) {
  const { ok, erro, resolvidos, tentados, aceitas, recusadas, detalhe, desativadas } = await searchParams;
  const [sources, runs, openRuns] = await Promise.all([listSources(), listIngestionRuns(20), runsWithOpenErrors(10)]);
  const details = await Promise.all(
    openRuns.map(async (run) => ({ run, errors: await listIngestionErrorsDetailed(run.runId) })),
  );

  return (
    <>
      <div className={styles["head"]}>
        <div>
          <h1 className="page-title">Fontes</h1>
          <p>Cada fonte tem o seu prazo de validade; preço mais velho que o prazo não aparece como atual.</p>
        </div>
      </div>
      {ok === "reprocessado" && (
        <div className={styles["ok"]}>
          Reprocessamento concluído: {resolvidos ?? "0"} de {tentados ?? "0"} erro(s) resolvido(s).
        </div>
      )}
      {ok === "ofertas" && (
        <div className={styles["ok"]}>
          {desativadas ?? "0"} oferta(s) desta fonte saíram da comparação. O histórico permanece.
        </div>
      )}
      {ok === "executado" && (
        <div className={styles["ok"]}>
          Coleta concluída: {aceitas ?? "0"} oferta(s) gravada(s), {recusadas ?? "0"} linha(s) recusada(s).
        </div>
      )}
      {ok !== undefined && ok !== "reprocessado" && ok !== "executado" && ok !== "ofertas" && (
        <div className={styles["ok"]}>Fonte atualizada.</div>
      )}
      {erro === "feed-https" && <div className={styles["error"]}>O feed precisa ser um endereço https.</div>}
      {erro === "feed-rede" && (
        <div className={styles["error"]}>
          O feed precisa ser um https público. Endereço local, IP privado ou nome que não resolve não é aceito.
        </div>
      )}
      {erro === "mapa" && (
        <div className={styles["error"]}>Mapa de campos inválido: {detalhe ?? "confira as linhas canonico=campo"}.</div>
      )}
      {erro === "fonte" && <div className={styles["error"]}>Informe nome e slug da fonte.</div>}
      {erro === "pausada" && <div className={styles["error"]}>A fonte está pausada; retome antes de executar.</div>}
      {erro !== undefined &&
        !["feed-https", "mapa", "fonte", "pausada"].includes(erro) && <div className={styles["error"]}>{erro}</div>}

      <section className={styles["card"]}>
        <h2>Fontes cadastradas</h2>
        <table className={styles["table"]}>
          <thead>
            <tr>
              <th>Fonte</th>
              <th>Situação</th>
              <th>Validade</th>
              <th>Última execução</th>
              <th>Falhas seguidas</th>
              <th>Alimenta a comparação?</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => {
              const lastRun = runs.find((run) => run.sourceId === source.id);
              return (
                <tr key={source.id}>
                  <td>
                    {source.name}
                    <div className={styles["muted"]}>{source.slug}</div>
                  </td>
                  <td>
                    <span className={`${styles["badge"]} ${source.enabled ? styles["published"] : styles["warn"]}`}>
                      {source.enabled ? "ativa" : "pausada"}
                    </span>
                    <div className={styles["muted"]}>{SOURCE_STATUS_LABELS[source.status]}</div>
                  </td>
                  <td className={styles["muted"]}>{source.maxAgeHours} h</td>
                  <td className={styles["muted"]}>
                    {lastRun === undefined ? "nunca" : new Date(lastRun.startedAt).toLocaleString("pt-BR")}
                  </td>
                  <td className={source.consecutiveFailures > 0 ? "" : styles["muted"]}>{source.consecutiveFailures}</td>
                  <td className={styles["muted"]}>{sourceIsUsable(source) ? "sim" : "não"}</td>
                  <td>
                    <div className={styles["actions"]}>
                      <form action={alternarFonte}>
                        <input type="hidden" name="id" value={source.id} />
                        <input type="hidden" name="ativa" value={source.enabled ? "0" : "1"} />
                        <button type="submit" className={styles["secondary"]}>
                          {source.enabled ? "Pausar" : "Retomar"}
                        </button>
                      </form>
                      <form action={executarImportacao}>
                        <input type="hidden" name="slug" value={source.slug} />
                        <button type="submit" className={styles["secondary"]}>
                          Executar agora
                        </button>
                      </form>
                      <form action={desativarOfertasDaFonte}>
                        <input type="hidden" name="id" value={source.id} />
                        <button type="submit" className={styles["secondary"]}>
                          Desativar ofertas
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sources.length === 0 && <p className={styles["muted"]}>Nenhuma fonte cadastrada.</p>}
      </section>

      <section className={styles["card"]}>
        <h2>Conectar fonte por URL</h2>
        <p className={styles["muted"]}>
          O parceiro entrega um arquivo JSON, CSV ou XML por URL. O de-para liga o nome do campo na fonte ao campo que a
          Tako entende, uma linha por campo: <code>priceCents=preco_centavos</code>. Campos: externalId, title,
          edition, platform, region, currency, priceCents, referencePriceCents, availability, url, coupon,
          subscription, observedAt, storeSlug. Salvar com o slug de uma fonte existente atualiza aquela fonte. A URL
          não volta para o formulário: deixe em branco para manter a que já está cadastrada.
        </p>
        <form action={salvarFonte} className={styles["form"]}>
          <div className={styles["grid2"]}>
            <label className={styles["field"]}>
              <span>Nome</span>
              <input name="nome" required placeholder="Feed do parceiro" />
            </label>
            <label className={styles["field"]}>
              <span>Slug</span>
              <input name="slug" placeholder="vem do nome" />
            </label>
            <label className={styles["field"]}>
              <span>URL do feed (https)</span>
              <input name="feedUrl" placeholder="https://… — em branco mantém a cadastrada" autoComplete="off" />
            </label>
            <label className={styles["field"]}>
              <span>Formato</span>
              <select name="formato" defaultValue="auto">
                <option value="auto">Detectar pelo conteúdo</option>
                <option value="json">JSON</option>
                <option value="xml">XML</option>
                <option value="csv">CSV</option>
              </select>
            </label>
            <label className={styles["field"]}>
              <span>Tipo</span>
              <select name="tipo" defaultValue="feed">
                <option value="feed">Feed</option>
                <option value="page">Página</option>
              </select>
            </label>
            <label className={styles["field"]}>
              <span>Validade do preço (horas)</span>
              <input name="validade" type="number" min={1} defaultValue={24} />
            </label>
            <label className={styles["field"]}>
              <span>Cadência de coleta (horas)</span>
              <input name="cadencia" type="number" min={1} defaultValue={24} />
            </label>
            <label className={styles["field"]}>
              <span>Cobre preço em BRL?</span>
              <input type="checkbox" name="cobreBrl" defaultChecked />
            </label>
          </div>
          <label className={styles["field"]}>
            <span>Mapa de campos (canonico=campo_na_fonte)</span>
            <textarea
              name="mapa"
              placeholder={"externalId=sku\npriceCents=preco_centavos\nurl=link\nstoreSlug=loja"}
            />
          </label>
          <label className={styles["field"]}>
            <span>Observações</span>
            <textarea name="observacoes" />
          </label>
          <div className={styles["actions"]}>
            <button type="submit" className={styles["primary"]}>
              Salvar fonte
            </button>
          </div>
        </form>
      </section>

      <section className={styles["card"]}>
        <h2>Matriz de fontes</h2>
        <p className={styles["muted"]}>
          O que se sabe de cada fonte, inclusive das candidatas que ainda não estão ligadas: acesso, formato,
          cobertura em real, frequência, documentação, termos e atribuição. Sem isso registrado, a fonte não entra na
          comparação.
        </p>
        {sources.map((source) => (
          <div key={source.id} className={styles["group"]}>
            <strong>{source.name}</strong>
            <p className={styles["muted"]}>
              {SOURCE_ACCESS_LABELS[source.access]} · {source.format} ·{" "}
              {feedHost(source.feedUrl)} ·{" "}
              {source.coversBrl ? "cobre BRL" : "sem cobertura em BRL confirmada"} ·{" "}
              {source.cadenceHours === null ? "frequência não informada" : `coleta a cada ${String(source.cadenceHours)} h`}
            </p>
            <form action={salvarMatrizFonte} className={styles["form"]}>
              <input type="hidden" name="id" value={source.id} />
              <div className={styles["grid2"]}>
                <label className={styles["field"]}>
                  <span>Situação</span>
                  <select name="situacao" defaultValue={source.status}>
                    {(Object.keys(SOURCE_STATUS_LABELS) as SourceStatus[]).map((status) => (
                      <option key={status} value={status}>
                        {SOURCE_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles["field"]}>
                  <span>Acesso</span>
                  <select name="acesso" defaultValue={source.access}>
                    {(Object.keys(SOURCE_ACCESS_LABELS) as SourceAccess[]).map((access) => (
                      <option key={access} value={access}>
                        {SOURCE_ACCESS_LABELS[access]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles["field"]}>
                  <span>Formato</span>
                  <select name="formato" defaultValue={source.format}>
                    {["json", "csv", "xml", "html", "unknown"].map((format) => (
                      <option key={format} value={format}>
                        {format}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles["field"]}>
                  <span>Frequência de coleta (horas)</span>
                  <input name="frequencia" type="number" min={1} defaultValue={source.cadenceHours ?? ""} />
                </label>
                <label className={styles["field"]}>
                  <span>Cobre preço em BRL?</span>
                  <input type="checkbox" name="cobreBrl" defaultChecked={source.coversBrl} />
                </label>
                <label className={styles["field"]}>
                  <span>Documentação</span>
                  <input name="documentacao" defaultValue={source.docsUrl ?? ""} placeholder="https://…" />
                </label>
                <label className={styles["field"]}>
                  <span>Termos de uso</span>
                  <input name="termos" defaultValue={source.termsUrl ?? ""} placeholder="https://…" />
                </label>
                <label className={styles["field"]}>
                  <span>Atribuição exigida</span>
                  <input name="atribuicao" defaultValue={source.attribution ?? ""} />
                </label>
              </div>
              <label className={styles["field"]}>
                <span>Observações</span>
                <textarea name="observacoes" defaultValue={source.notes ?? ""} />
              </label>
              <div className={styles["actions"]}>
                <button type="submit" className={styles["primary"]}>
                  Salvar matriz
                </button>
              </div>
            </form>
          </div>
        ))}
      </section>

      <section className={styles["card"]}>
        <h2>Erros aguardando reprocessamento</h2>
        {details.length === 0 ? (
          <p className={styles["muted"]}>Nenhum erro aberto. A importação está em dia.</p>
        ) : (
          details.map(({ run, errors }) => (
            <div key={run.runId} className={styles["group"]}>
              <strong>
                {run.sourceName} · {new Date(run.startedAt).toLocaleString("pt-BR")}
              </strong>
              <p className={styles["muted"]}>
                {run.openErrors} erro(s) aberto(s). Reprocessar tenta de novo o conteúdo recusado — vale depois de
                corrigir o cadastro da loja, aprovar um vínculo ou ajustar a regra que recusou a linha.
              </p>
              <ul className={styles["groupList"]}>
                {errors
                  .filter((error) => error.resolvedAt === null)
                  .slice(0, 8)
                  .map((error) => (
                    <li key={error.id}>
                      linha {error.line ?? "?"}: <code>{error.code}</code> — {error.message}
                    </li>
                  ))}
              </ul>
              <form action={reprocessarExecucao}>
                <input type="hidden" name="execucaoId" value={run.runId} />
                <button type="submit" className={styles["primary"]}>
                  Reprocessar erros
                </button>
              </form>
            </div>
          ))
        )}
      </section>

      <section className={styles["card"]}>
        <h2>Execuções</h2>
        {runs.length === 0 ? (
          <p className={styles["muted"]}>Nenhuma execução registrada.</p>
        ) : (
          <table className={styles["table"]}>
            <thead>
              <tr>
                <th>Fonte</th>
                <th>Início</th>
                <th>Por</th>
                <th>Recebidas</th>
                <th>Aceitas</th>
                <th>Rejeitadas</th>
                <th>Erros abertos</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>{run.sourceName}</td>
                  <td className={styles["muted"]}>{new Date(run.startedAt).toLocaleString("pt-BR")}</td>
                  <td className={styles["muted"]}>{run.triggeredBy}</td>
                  <td>{run.received}</td>
                  <td>{run.accepted}</td>
                  <td>{run.rejected}</td>
                  <td className={styles["muted"]}>{run.openErrors}</td>
                  <td>
                    <span
                      className={`${styles["badge"]} ${
                        run.status === "success" ? styles["published"] : run.status === "failed" ? styles["warn"] : styles["hidden"]
                      }`}
                    >
                      {run.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className={styles["muted"]} style={{ marginTop: 12 }}>
          Coleta pela linha de comando: <code>npm run worker -- import --source &lt;slug&gt;</code>. O reprocessamento
          daqui usa o mesmo código do worker.
        </p>
      </section>
    </>
  );
}
