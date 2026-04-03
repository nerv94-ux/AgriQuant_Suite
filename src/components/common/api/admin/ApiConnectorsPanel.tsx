import {
  getEcoCertSettingsOverview,
  getEcoPriceSettingsOverview,
  getEcountSettingsOverview,
  getGeminiSettingsOverview,
  getKmaSettingsOverview,
  getMafraSettingsOverview,
  getNaverSettingsOverview,
} from "../server/admin/providerSettings";
import { buildConnectorSummaries } from "./catalog";
import { ApiConnectorWorkspace } from "./ApiConnectorWorkspace";

export async function ApiConnectorsPanel({
  initialConnectorId,
}: {
  initialConnectorId?: string;
} = {}) {
  const [geminiOverview, ecountOverview, kmaOverview, ecoPriceOverview, ecoCertOverview, naverOverview, mafraOverview] = await Promise.all([
    getGeminiSettingsOverview(),
    getEcountSettingsOverview(),
    getKmaSettingsOverview(),
    getEcoPriceSettingsOverview(),
    getEcoCertSettingsOverview(),
    getNaverSettingsOverview(),
    getMafraSettingsOverview(),
  ]);
  const rows = buildConnectorSummaries({
    geminiOverview,
    ecountOverview,
    kmaOverview,
    ecoPriceOverview,
    ecoCertOverview,
    naverOverview,
    mafraOverview,
  });

  return (
    <ApiConnectorWorkspace
      connectors={rows}
      geminiOverview={geminiOverview}
      ecountOverview={ecountOverview}
      kmaOverview={kmaOverview}
      ecoPriceOverview={ecoPriceOverview}
      ecoCertOverview={ecoCertOverview}
      naverOverview={naverOverview}
      mafraOverview={mafraOverview}
      initialConnectorId={initialConnectorId}
    />
  );
}

