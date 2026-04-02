export type ApiConnectorStatus = "configured" | "partial" | "missing";

export type ApiConnectorBindingMode = "shared-default" | "program-selectable";

export type ApiConnectorHealthStatus =
  | "healthy"
  | "unhealthy"
  | "unknown"
  | "checking"
  | "unsupported";

export type ApiConnectorSummary = {
  id: string;
  name: string;
  category: string;
  description: string;
  requiredKeys: string[];
  configuredKeys: string[];
  setupStatus: ApiConnectorStatus;
  setupLabel: string;
  healthStatus: ApiConnectorHealthStatus;
  healthLabel: string;
  healthMessage: string;
  lastCheckedAt: string | null;
  healthDurationMs: number | null;
  healthSupported: boolean;
  healthStale: boolean;
  usageScope: string;
  bindingMode: ApiConnectorBindingMode;
  nextStep: string;
};
