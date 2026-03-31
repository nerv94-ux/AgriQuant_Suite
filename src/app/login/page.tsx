import { AuthLoginPage } from "@/components/common/auth";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { appId?: string };
}) {
  return <AuthLoginPage searchParams={searchParams} />;
}

