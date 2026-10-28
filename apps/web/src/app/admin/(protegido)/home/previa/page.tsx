import Link from "next/link";
import { listAllBanners, listAllSections } from "@tako/db";
import { HomeView } from "@/components/loja/HomeView/HomeView";
import { loadShop } from "@/server/shop";
import adminStyles from "../../../admin.module.css";

export const dynamic = "force-dynamic";

/**
 * Prévia da home (PRD §12.4): o que a loja mostraria se tudo estivesse publicado — seções e banners entram
 * mesmo ocultos ou fora da janela. Nada aqui grava; a prévia não é a home pública.
 */
export default async function PreviaHome() {
  const [shop, sections, banners] = await Promise.all([loadShop(), listAllSections(), listAllBanners()]);
  const ocultas = sections.filter((section) => !section.published).length;

  return (
    <>
      <div className={adminStyles["head"]}>
        <div>
          <h1 className="page-title">Prévia da home</h1>
          <p>
            Tudo aparece, inclusive o oculto{ocultas > 0 ? ` — ${String(ocultas)} seção(ões) não publicada(s)` : ""}. A
            home pública só mostra o publicado e dentro da janela.
          </p>
        </div>
        <div className={adminStyles["actions"]}>
          <Link href="/admin/home" className={adminStyles["secondary"]}>
            Voltar ao painel
          </Link>
        </div>
      </div>
      <HomeView shop={shop} banners={banners} sections={sections} />
    </>
  );
}
