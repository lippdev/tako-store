import { listAdminUsers, type Role } from "@tako/db";
import { alternarUsuario, revogarSessoesDoUsuario, salvarUsuario, trocarPapel } from "../../actions";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  catalog: "Editor de catálogo",
  content: "Editor de conteúdo",
  integrations: "Operador de integrações",
  viewer: "Leitura",
};

/** Usuários do painel e sessões (PRD §12.1): papel, ativação e revogação de sessão. */
export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string; revogadas?: string }>;
}) {
  const { ok, erro, revogadas } = await searchParams;
  const users = await listAdminUsers();

  return (
    <>
      <div className={styles["head"]}>
        <div>
          <h1 className="page-title">Usuários</h1>
          <p>
            Cada pessoa tem um papel; a permissão é conferida no servidor em cada ação. Desativar um usuário revoga as
            sessões dele na hora.
          </p>
        </div>
      </div>
      {ok === "sessoes" && (
        <div className={styles["ok"]}>{revogadas ?? "0"} sessão(ões) revogada(s). O próximo acesso pede senha.</div>
      )}
      {ok !== undefined && ok !== "sessoes" && <div className={styles["ok"]}>Usuário atualizado.</div>}
      {erro === "senha" && <div className={styles["error"]}>A senha precisa ter pelo menos 12 caracteres.</div>}
      {erro === "proprio-usuario" && (
        <div className={styles["error"]}>
          Você não pode desativar a própria conta nem tirar o seu papel de administrador.
        </div>
      )}
      {erro !== undefined && erro !== "senha" && erro !== "proprio-usuario" && (
        <div className={styles["error"]}>Confira os dados do usuário.</div>
      )}

      <section className={styles["card"]}>
        <h2>Quem tem acesso</h2>
        <table className={styles["table"]}>
          <thead>
            <tr>
              <th>Pessoa</th>
              <th>Papel</th>
              <th>Sessões ativas</th>
              <th>Último acesso</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  {user.name}
                  <div className={styles["muted"]}>
                    {user.email} · {user.active ? "ativo" : "desativado"}
                  </div>
                </td>
                <td>
                  <form action={trocarPapel} className={styles["inline"]}>
                    <input type="hidden" name="id" value={user.id} />
                    <select name="papel" defaultValue={user.role}>
                      {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className={styles["secondary"]}>
                      Trocar
                    </button>
                  </form>
                </td>
                <td className={styles["muted"]}>{user.sessions}</td>
                <td className={styles["muted"]}>
                  {user.lastLoginAt === null ? "nunca" : new Date(user.lastLoginAt).toLocaleString("pt-BR")}
                </td>
                <td>
                  <div className={styles["actions"]}>
                    <form action={alternarUsuario}>
                      <input type="hidden" name="id" value={user.id} />
                      <input type="hidden" name="ativo" value={user.active ? "0" : "1"} />
                      <button type="submit" className={styles["secondary"]}>
                        {user.active ? "Desativar" : "Ativar"}
                      </button>
                    </form>
                    <form action={revogarSessoesDoUsuario}>
                      <input type="hidden" name="id" value={user.id} />
                      <button type="submit" className={styles["secondary"]}>
                        Revogar sessões
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles["card"]}>
        <h2>Novo usuário ou troca de senha</h2>
        <p className={styles["muted"]}>
          A senha é gravada como hash com sal; ela nunca é exibida de novo. Salvar um e-mail que já existe troca a
          senha e o papel daquela pessoa.
        </p>
        <form action={salvarUsuario} className={styles["form"]}>
          <div className={styles["grid2"]}>
            <label className={styles["field"]}>
              <span>Nome</span>
              <input name="nome" required />
            </label>
            <label className={styles["field"]}>
              <span>E-mail</span>
              <input name="email" type="email" required />
            </label>
            <label className={styles["field"]}>
              <span>Papel</span>
              <select name="papel" defaultValue="viewer">
                {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles["field"]}>
              <span>Senha (mínimo 12 caracteres)</span>
              <input name="senha" type="password" minLength={12} required autoComplete="new-password" />
            </label>
          </div>
          <div className={styles["actions"]}>
            <button type="submit" className={styles["primary"]}>
              Salvar usuário
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
