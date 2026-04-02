import {
  getEcoPriceSettingsOverview,
  getEcountSettingsOverview,
  getGeminiSettingsOverview,
  getKmaSettingsOverview,
} from "../server/admin/providerSettings";
import { buildConnectorSummaries } from "./catalog";
import { ApiConnectorWorkspace } from "./ApiConnectorWorkspace";

export async function ApiConnectorsPanel({
  initialConnectorId,
}: {
  initialConnectorId?: string;
} = {}) {
  const [geminiOverview, ecountOverview, kmaOverview, ecoPriceOverview] = await Promise.all([
    getGeminiSettingsOverview(),
    getEcountSettingsOverview(),
    getKmaSettingsOverview(),
    getEcoPriceSettingsOverview(),
  ]);
  const rows = buildConnectorSummaries({ geminiOverview, ecountOverview, kmaOverview, ecoPriceOverview });

  return (
    <ApiConnectorWorkspace
      connectors={rows}
      geminiOverview={geminiOverview}
      ecountOverview={ecountOverview}
      kmaOverview={kmaOverview}
      ecoPriceOverview={ecoPriceOverview}
      initialConnectorId={initialConnectorId}
    />
  );
}

