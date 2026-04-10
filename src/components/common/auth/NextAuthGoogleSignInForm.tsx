"use client";

import { signIn } from "next-auth/react";
import { useCallback, useState } from "react";

export type GoogleSignInFormProps = {
  callbackUrl?: string;
  className?: string;
  buttonText?: string;
  /**
   * 로그인 직전에 "어느 앱(appId)에서 들어왔는지"를 쿠키로 남기기 위한 값.
   * 서버가 다음 렌더/페이지에서 DB(User.registeredAppId)에 반영한다.
   */
  rememberAppId?: string;
};

export function GoogleSignInForm({
  callbackUrl,
  className,
  buttonText = "Google로 계속하기",
  rememberAppId,
}: GoogleSignInFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const onClick = useCallback(async () => {
    setError(null);
    setIsBusy(true);
    try {
      if (rememberAppId) {
        // 서버 컴포넌트에서 cookies()로 읽어 User.registeredAppId에 최초 1회 기록
        document.cookie = `agri_registered_app_id=${encodeURIComponent(
          rememberAppId
        )}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
      }

      const res = await signIn("google", {
        callbackUrl: callbackUrl ?? "/",
      });

      // res가 오고 error가 있으면 로그인 실패 케이스
      if (res && "error" in res && res?.error) {
        setError("Google 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인 처리 중 오류가 발생했습니다.");
    } finally {
      setIsBusy(false);
    }
  }, [callbackUrl, rememberAppId]);

  return (
    <section
      className={[
        "w-full max-w-md mx-auto",
        "rounded-3xl border border-zinc-200",
        "bg-white",
        "shadow-[0_20px_50px_-30px_rgba(0,0,0,0.12)]",
        "p-6 sm:p-7",
        className ?? "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900">로그인</h2>
          <p className="mt-1 text-sm text-zinc-600">Google 계정으로 안전하게 로그인하세요.</p>
        </div>
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={onClick}
          disabled={isBusy}
          className={[
            "group relative w-full",
            "flex items-center justify-center gap-3",
            "rounded-2xl",
            "h-12",
            "transition",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            "border border-zinc-200",
            "bg-white hover:bg-zinc-50 active:bg-zinc-100",
          ].join(" ")}
        >
          <GoogleIcon />
          <span className="text-sm font-semibold text-zinc-800">{buttonText}</span>
          {isBusy ? (
            <span className="absolute right-4 text-xs text-zinc-500">처리 중...</span>
          ) : null}
        </button>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-600 leading-relaxed">{error}</p>
      ) : (
        <p className="mt-3 text-xs text-zinc-500 leading-relaxed">
          로그인 후 계정은 승인 대기(PENDING) 상태로 저장되며, 관리자 승인 후 서비스 이용이 가능합니다.
        </p>
      )}
    </section>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.1 5.657-5.88 9.89-11.303 9.89-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.037l5.657-5.657C34.046 6.053 29.173 4 24 4 12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20c0-1.341-.138-2.655-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 16.108 19.345 12 24 12c3.059 0 5.842 1.154 7.961 3.037l5.657-5.657C34.046 6.053 29.173 4 24 4c-7.516 0-14.02 4.264-17.694 10.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.171 0 10.045-2.053 13.607-5.52l-5.657-5.657C29.84 35.97 27.057 37.124 24 37.124c-4.655 0-9.345-4.108-11.123-7.51l-6.57 4.819C9.98 39.736 16.484 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.918 4.725-4.517 8.43-9.267 9.597l.01.004 6.57 4.819C37.82 43.993 44 36.52 44 28c0-1.341-.138-2.655-.389-3.917z"
      />
    </svg>
  );
}

