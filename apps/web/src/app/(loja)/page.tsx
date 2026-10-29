import { listLiveBanners, listLiveSections } from "@tako/db";
import { HomeView } from "@/components/loja/HomeView/HomeView";
import { loadShop } from "@/server/shop";

export const dynamic = "force-dynamic";

/** Home: banner principal e seções configuradas no painel (STO-001). Seção vazia não aparece. */
export default async function HomePage() {
  const [shop, banners, sections] = await Promise.all([loadShop(), listLiveBanners(), listLiveSections()]);
  return <HomeView shop={shop} banners={banners} sections={sections} />;
}
