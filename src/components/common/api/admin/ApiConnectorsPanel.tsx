type ApiConnector = {
  id: string;
  name: string;
  description: string;
  envKeys: string[];
  docsHint?: string;
};

const connectors: ApiConnector[] = [
  {
    id: "google-ai",
    name: "Google Gemini",
    description: "AI 분석 및 자동화 로직에 사용됩니다.",
    envKeys: ["GEMINI_API_KEY"],
  },
  {
    id: "garak-market",
    name: "가락동 도매시장 API",
    description: "도매 시세 수집 및 기준 가격 생성에 사용됩니다.",
    envKeys: ["GARAK_API_KEY"],
  },
  {
    id: "ecount",
    name: "eCount API",
    description: "사내 ERP 데이터 동기화에 사용됩니다.",
    envKeys: ["ECOUNT_API_KEY", "ECOUNT_COMPANY_CODE"],
  },
  {
    id: "naver-shopping",
    name: "네이버 쇼핑 API",
    description: "온라인 소비자 가격 비교 데이터 수집에 사용됩니다.",
    envKeys: ["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"],
  },
];

export function ApiConnectorsPanel() {
  const rows = connectors.map((c) => {
    const configured = c.envKeys.filter((k) => Boolean(process.env[k]));
    const complete = configured.length === c.envKeys.length;
    return {
      ...c,
      configured,
      complete,
    };
  });

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-white">API 관리</h2>
        <p className="mt-2 text-sm text-zinc-300 leading-relaxed">
          공용 커넥터 설정 상태를 확인하고, 신규 앱에서도 동일한 연결 규칙을 유지합니다.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((row) => (
          <article
            key={row.id}
            className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-white">{row.name}</h3>
              <span
                className={[
                  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                  row.complete
                    ? "bg-emerald-500/20 text-emerald-200 border border-emerald-300/20"
                    : "bg-amber-500/20 text-amber-200 border border-amber-300/20",
                ].join(" ")}
              >
                {row.complete ? "설정 완료" : "설정 필요"}
              </span>
            </div>

            <p className="mt-2 text-sm text-zinc-300">{row.description}</p>

            <div className="mt-4">
              <p className="text-xs font-semibold text-zinc-400">필수 환경변수</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {row.envKeys.map((key) => {
                  const isSet = row.configured.includes(key);
                  return (
                    <span
                      key={key}
                      className={[
                        "rounded-lg border px-2 py-1 text-xs",
                        isSet
                          ? "border-emerald-300/20 bg-emerald-500/15 text-emerald-100"
                          : "border-zinc-600 bg-zinc-800/80 text-zinc-300",
                      ].join(" ")}
                    >
                      {key}
                    </span>
                  );
                })}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

