// Registro dos conectores: a fonte é encontrada pelo slug no banco. Um ciclo de import aqui seria frágil —
// por isto o registro vive fora do arquivo do contrato.

import { demoFeedConnector, demoFileConnector } from "./connector";
import { steamConnector } from "./steam";
import type { Connector } from "./connector";

export const CONNECTORS: readonly Connector[] = [demoFileConnector, demoFeedConnector, steamConnector];

export function connectorFor(sourceSlug: string): Connector | null {
  return CONNECTORS.find((connector) => connector.slug === sourceSlug) ?? null;
}
