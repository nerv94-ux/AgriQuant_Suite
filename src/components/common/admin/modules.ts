export type AdminModuleAvailability = "live" | "planned";

export type AdminModuleDefinition = {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  summary: string;
  availability: AdminModuleAvailability;
  href?: string;
  badge: string;
  accentClassName: string;
};

export const adminHomeItem = {
  href: "/admin",
  label: "모듈 센터",
  description: "운영 모듈 상태와 확장 계획을 한 화면에서 관리합니다.",
};

export const adminModules: AdminModuleDefinition[] = [
  {
    id: "auth",
    label: "Auth",
    shortLabel: "AU",
    description: "공용 로그인, 사용자 승인, 앱 등록 흐름을 관리합니다.",
    summary: "사용자 승인과 앱별 가입 흐름을 운영합니다.",
    availability: "live",
    href: "/admin/users",
    badge: "LIVE",
    accentClassName: "from-emerald-400/25 via-emerald-400/10 to-transparent",
  },
  {
    id: "api",
    label: "API",
    shortLabel: "AP",
    description: "커넥터 설정, 비밀키, 호출 안정성, 프로그램별 연결 정책을 관리합니다.",
    summary: "공용 API 커넥터와 향후 프로그램별 연결 정책의 중심입니다.",
    availability: "live",
    href: "/admin/apis",
    badge: "LIVE",
    accentClassName: "from-sky-400/25 via-sky-400/10 to-transparent",
  },
  {
    id: "ui",
    label: "UI",
    shortLabel: "UI",
    description: "관리자 공통 레이아웃, 디자인 토큰, 화면 패턴을 모듈 단위로 통합합니다.",
    summary: "콘솔 UI 표준화와 재사용 컴포넌트를 확장할 예정입니다.",
    availability: "planned",
    badge: "PLAN",
    accentClassName: "from-violet-400/25 via-violet-400/10 to-transparent",
  },
  {
    id: "logs",
    label: "Logs",
    shortLabel: "LG",
    description: "API 호출 로그, 감사 로그, 운영 이벤트를 모듈별로 묶어 추적합니다.",
    summary: "문제 분석과 운영 히스토리 확인용 로그 허브를 준비합니다.",
    availability: "planned",
    badge: "PLAN",
    accentClassName: "from-amber-400/25 via-amber-400/10 to-transparent",
  },
  {
    id: "programs",
    label: "Programs",
    shortLabel: "PG",
    description: "프로그램별 어떤 Auth/API/UI 구성을 사용할지 정책으로 제어합니다.",
    summary: "프로그램별 API 연결 조합과 권한 정책의 제어면을 위한 자리입니다.",
    availability: "planned",
    badge: "PLAN",
    accentClassName: "from-fuchsia-400/25 via-fuchsia-400/10 to-transparent",
  },
];

export const liveAdminModules = adminModules.filter((module) => module.availability === "live");

export const plannedAdminModules = adminModules.filter(
  (module) => module.availability === "planned"
);

export function isAdminHrefActive(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
