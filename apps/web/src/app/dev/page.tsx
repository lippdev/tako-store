import type { Metadata } from "next";
import { DevPage } from "@/dev/DevPage";

export const metadata: Metadata = { title: "Base visual" };

export default function BaseVisualPage() {
  return <DevPage />;
}
