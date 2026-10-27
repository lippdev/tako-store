import type { Metadata } from "next";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Privacidade",
  description: "O que a Tako Store registra, para quê, e por quanto tempo.",
  alternates: { canonical: "/privacidade" },
};

/** Aviso do que a loja realmente coleta (PRD §17.5). Sem conta pública, sem rastreio de anúncio. */
export default function PrivacidadePage() {
  return (
    <article className={styles["page"]}>
      <h1 className="page-title">Privacidade</h1>
      <p>A loja pública não pede conta, não pede e-mail e não instala cookie de rastreio.</p>

      <h2>Clique em uma oferta</h2>
      <p>
        Quando você abre o botão de uma oferta, a Tako Store registra só o identificador da oferta e o horário. Não
        registra nome, e-mail, endereço IP nem a página de onde você veio. O registro serve para saber quais ofertas
        as pessoas acompanham. Ele não muda a ordem da comparação por preço e não é vendido.
      </p>
      <p>Esse registro é apagado depois de 180 dias.</p>

      <h2>Compra</h2>
      <p>
        A compra acontece no site da loja escolhida. A Tako Store não processa pagamento e não recebe os dados do
        pedido. Alguns links são de afiliado: a comissão, quando existe, não altera a ordem da comparação.
      </p>

      <h2>Painel administrativo</h2>
      <p>
        Quem entra no painel tem uma sessão no navegador, limitada ao painel, marcada como httpOnly. Tentativa de
        login guarda o e-mail e o endereço IP por até 24 horas, só para impedir adivinhação de senha. Ação
        administrativa fica no registro de auditoria por 365 dias. Erro de importação já resolvido sai depois de 90
        dias.
      </p>

      <h2>Preço</h2>
      <p>
        O histórico de preço fica guardado porque a página do jogo mostra a variação ao longo do tempo. Ele traz
        valor, moeda, loja e horário — nada de quem consultou.
      </p>

      <h2>O que não entra</h2>
      <p>Credencial de afiliado, token de feed e senha não vão para log, para a auditoria nem de volta para a tela depois de cadastrados.</p>
    </article>
  );
}
