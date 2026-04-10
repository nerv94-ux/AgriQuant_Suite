import { GoogleSignInForm } from "../NextAuthGoogleSignInForm";

type AuthLoginPageProps = {
  searchParams?: { appId?: string };
};

export function AuthLoginPage({ searchParams }: AuthLoginPageProps) {
  const appId = searchParams?.appId?.trim() || "agriquote";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-100 px-4 py-16">
      <div className="w-full max-w-md">
        <GoogleSignInForm callbackUrl="/" rememberAppId={appId} />
      </div>
    </div>
  );
}

