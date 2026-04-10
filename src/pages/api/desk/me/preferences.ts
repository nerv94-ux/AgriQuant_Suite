import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import {
  getDeskProductListFilterPreference,
  getDeskProductListSortPreference,
  mergeUserDeskPreferences,
} from "@/components/desk/server/deskProductUserPreferenceQueries";
import type { DeskProductListFilter } from "@/components/desk/server/deskProductQueries";
import type { DeskProductListSortMode } from "@/components/desk/server/deskProductUserPreferenceQueries";

type OkGet = {
  ok: true;
  desk: { productListFilter: DeskProductListFilter; productListSort: DeskProductListSortMode };
};
type OkPatch = { ok: true };
type ErrBody = { ok: false; message: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<OkGet | OkPatch | ErrBody>) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.approvalStatus !== "APPROVED") {
    return res.status(403).json({ ok: false, message: "FORBIDDEN" });
  }

  const userId = session.user.id;

  if (req.method === "GET") {
    const productListFilter = await getDeskProductListFilterPreference(userId);
    const productListSort = await getDeskProductListSortPreference(userId);
    return res.status(200).json({
      ok: true,
      desk: { productListFilter, productListSort },
    });
  }

  if (req.method === "PATCH") {
    const body = (req.body ?? {}) as {
      desk?: { productListFilter?: unknown; productListSort?: unknown };
    };
    const f = body.desk?.productListFilter;
    const s = body.desk?.productListSort;
    const patch: { productListFilter?: DeskProductListFilter; productListSort?: DeskProductListSortMode } = {};
    if (f === "active" || f === "all" || f === "inactive") {
      patch.productListFilter = f;
    }
    if (s === "alpha" || s === "my" || s === "recent") {
      patch.productListSort = s;
    }
    if (patch.productListFilter === undefined && patch.productListSort === undefined) {
      return res.status(400).json({
        ok: false,
        message:
          "desk.productListFilter(active|inactive|all) 또는 desk.productListSort(alpha|my|recent) 중 하나 이상이 필요합니다.",
      });
    }
    await mergeUserDeskPreferences(userId, patch);
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, PATCH");
  return res.status(405).json({ ok: false, message: "METHOD_NOT_ALLOWED" });
}
