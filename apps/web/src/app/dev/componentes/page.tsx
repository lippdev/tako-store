import type { Metadata } from "next";
import { Gallery } from "@/dev/Gallery";

export const metadata: Metadata = { title: "Componentes" };

export default function ComponentesPage() {
  return <Gallery />;
}
