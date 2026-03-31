import { cookies } from "next/headers";
import { prisma } from "./prisma";

const COOKIE_NAME = "agri_registered_app_id";

export async function registerAppForCurrentUser(params: { sessionUserId?: string }) {
  const cookieStore = await cookies();
  const appIdCookie = cookieStore.get(COOKIE_NAME)?.value;
  const appId = appIdCookie?.trim();
  if (!appId) return;

  const userId = params.sessionUserId;
  if (!userId) return;

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { registeredAppId: true },
  });

  // 처음 한 번만 기록(운영 정책에 따라 "항상 덮어쓰기"로 바꿀 수 있음)
  if (!existing?.registeredAppId) {
    await prisma.user.update({
      where: { id: userId },
      data: { registeredAppId: appId },
    });
  }
}

