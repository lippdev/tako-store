import Link from "next/link";
import { Vazio } from "@/components/loja/Vazio/Vazio";

export default function NotFound() {
  return (
    <div style={{ padding: "64px 0" }}>
      <Vazio title="Esta página não existe">
        O jogo pode ter saído do catálogo. <Link href="/jogos">Veja o catálogo completo</Link>.
      </Vazio>
    </div>
  );
}
