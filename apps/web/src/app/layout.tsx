import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Appearance } from "@/components/Appearance/Appearance";
import "../styles/tokens.css";
import "../styles/base.css";

export const metadata: Metadata = {
  title: {
    default: "Tako Store — jogos e comparação de preços",
    template: "%s · Tako Store",
  },
  description:
    "Compare ofertas válidas para o Brasil e encontre o menor preço elegível entre as lojas acompanhadas.",
  metadataBase: new URL(process.env["NEXT_PUBLIC_SITE_URL"] ?? "http://localhost:5174"),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="tako">
      <body>
        <Appearance />
        {children}
      </body>
    </html>
  );
}
