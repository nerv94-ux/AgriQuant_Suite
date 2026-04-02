import { ApiConnectorsPanel } from "@/components/common/api/admin/ApiConnectorsPanel";
import { AdminApiTrialSandbox } from "@/components/common/api/admin/AdminApiTrialSandbox";

type AdminApisPageProps = {
  searchParams: Promise<{ connector?: string | string[] | undefined }>;
};

export default async function AdminApisPage({ searchParams }: AdminApisPageProps) {
  const resolvedSearchParams = await searchParams;
  const connector =
    typeof resolvedSearchParams.connector === "string"
      ? resolvedSearchParams.connector
      : Array.isArray(resolvedSearchParams.connector)
        ? resolvedSearchParams.connector[0]
        : undefined;

  return (
    <>
      <ApiConnectorsPanel initialConnectorId={connector} />
      <AdminApiTrialSandbox />
    </>
  );
}

