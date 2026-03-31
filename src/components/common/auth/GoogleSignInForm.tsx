"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type GoogleSignInFormProps = {
  /**
   * Google Identity Services(GIS) Client ID.
   * 환경변수로 주입해두면 OAuth 흐름이 동작하고,
   * 비어있으면 UI만 보여주고 클릭 시 안내 메시지만 띄운다.
   */
  googleClientId?: string;
  /**
   * GIS callback으로 넘어온 credential(JWT)을 서버로 보내거나,
   * 직접 검증하는 등 후속 처리를 여기서 한다.
   */
  onCredential?: (credential: string) => Promise<void> | void;
  className?: string;
  buttonText?: string;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          prompt: () => void;
        };
      };
    };
  }
}

async function loadGoogleIdentityScript(): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(
    'script[data-gis="true"]'
  );
  if (existing) return;

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.gis = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity script."));
    document.head.appendChild(script);
  });
}

export function GoogleSignInForm({
  googleClientId,
  onCredential,
  className,
  buttonText = "Google로 계속하기",
}: GoogleSignInFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const initializedRef = useRef(false);

  const hasClientId = useMemo(() => Boolean(googleClientId && googleClientId.trim().length > 0), [
    googleClientId,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function initIfNeeded() {
      if (!hasClientId) return;
      if (initializedRef.current) return;

      try {
        await loadGoogleIdentityScript();
        if (cancelled) return;

        if (!window.google?.accounts?.id) {
          throw new Error("Google Identity Services is unavailable.");
        }

        window.google.accounts.id.initialize({
          client_id: googleClientId!,
          callback: async (response) => {
            const credential = response.credential;
            if (!credential) {
              setError("Google 인증 정보를 확인할 수 없습니다. 다시 시도해 주세요.");
              return;
            }

            try {
              setIsBusy(true);
              setError(null);
              await onCredential?.(credential);
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "로그인 처리 중 오류가 발생했습니다. 다시 시도해 주세요."
              );
            } finally {
              setIsBusy(false);
            }
          },
        });

        initializedRef.current = true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Google 스크립트 로드에 실패했습니다.");
      }
    }

    initIfNeeded();

    return () => {
      cancelled = true;
    };
  }, [googleClientId, hasClientId, onCredential]);

  const onClick = useCallback(async () => {
    setError(null);

    if (!hasClientId) {
      setError("Google 로그인을 사용하려면 `NEXT_PUBLIC_GOOGLE_CLIENT_ID` 설정이 필요합니다.");
      return;
    }

    if (!initializedRef.current) {
      // initialize는 useEffect에서 수행하지만, 클릭 시점에 아직 준비가 안 됐을 수 있으니 방어.
      try {
        setIsBusy(true);
        await loadGoogleIdentityScript();
        if (!window.google?.accounts?.id) {
          throw new Error("Google Identity Services is unavailable.");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Google 로그인 준비 중 오류가 발생했습니다.");
      } finally {
        setIsBusy(false);
      }
    }

    try {
      setIsBusy(true);
      window.google?.accounts?.id?.prompt();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google 로그인 창을 표시하지 못했습니다.");
      setIsBusy(false);
      return;
    }

    // prompt 자체는 즉시 응답을 보장하지 않아서, 종료 처리는 callback에서 처리한다.
    setIsBusy(false);
  }, [hasClientId]);

  return (
    <section
      className={[
        "w-full max-w-md mx-auto",
        "rounded-3xl border border-white/10",
        "bg-black/30 dark:bg-black/40",
        "backdrop-blur-xl",
        "shadow-[0_20px_60px_-35px_rgba(0,0,0,0.9)]",
        "p-6 sm:p-7",
        className ?? "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white/95">로그인</h2>
          <p className="mt-1 text-sm text-white/70">
            Google 계정으로 안전하게 로그인하세요.
          </p>
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
            "border border-white/10",
            "bg-white/10 hover:bg-white/15 active:bg-white/20",
          ].join(" ")}
        >
          <GoogleIcon />
          <span className="text-sm font-semibold text-white/95">{buttonText}</span>
          {isBusy ? (
            <span className="absolute right-4 text-xs text-white/60">처리 중...</span>
          ) : null}
        </button>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-200/90 leading-relaxed">
          {error}
        </p>
      ) : (
        <p className="mt-3 text-xs text-white/55 leading-relaxed">
          Google 로그인은 설정이 완료되면 정상적으로 동작합니다.
        </p>
      )}
    </section>
  );
}

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 48 48"
      aria-hidden="true"
      className="shrink-0"
    >
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

