"use client";

import { useEffect } from "react";
import { applyAppearance, defaultAppearance } from "@/appearance/appearance";

/**
 * Escreve a aparência padrão no `<html>` depois da hidratação. O atributo `data-theme="tako"` já vem do servidor, e
 * quem escolhe tema, escala e movimento é a página `/dev`, que também passa por aqui.
 */
export function Appearance() {
  useEffect(() => {
    applyAppearance(defaultAppearance);
  }, []);
  return null;
}
