"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { DataTable, type DataTableColumn } from "../table/DataTable";

type PendingUser = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  registeredAppId: string | null;
  createdAt: string | Date;
};

export function PendingUsersAdminClient({
  initialAppIds,
  initialUsers,
}: {
  initialAppIds: string[];
  initialUsers: PendingUser[];
}) {
  const [selectedAppId, setSelectedAppId] = useState<string>("ALL");
  const [users, setUsers] = useState<PendingUser[]>(initialUsers);
  const [isLoading, setIsLoading] = useState(false);

  const appOptions = useMemo(
    () => initialAppIds.slice().sort((a, b) => a.localeCompare(b)),
    [initialAppIds]
  );

  const fetchUsers = useCallback(async (appId: string) => {
    setIsLoading(true);
    try {
      const url =
        appId === "ALL"
          ? "/api/admin/users/pending"
          : `/api/admin/users/pending?appId=${encodeURIComponent(appId)}`;

      const res = await fetch(url, { method: "GET" });
      const data = (await res.json()) as { pendingUsers: PendingUser[] };
      setUsers(data.pendingUsers ?? []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  const onChangeApp = async (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedAppId(value);
    await fetchUsers(value);
  };

  const act = useCallback(
    async (userId: string, action: "approve" | "reject") => {
      const endpoint =
        action === "approve"
          ? `/api/admin/users/${encodeURIComponent(userId)}/approve`
          : `/api/admin/users/${encodeURIComponent(userId)}/reject`;

      setIsLoading(true);
      try {
        const res = await fetch(endpoint, { method: "POST" });
        if (!res.ok) return;
        await fetchUsers(selectedAppId);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchUsers, selectedAppId]
  );

  const columns = useMemo<DataTableColumn<PendingUser>[]>(
    () => [
      {
        key: "user",
        header: "사용자",
        cell: (u) => (
          <div className="flex items-center gap-3">
            {u.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={u.image}
                alt={u.name ?? u.email ?? "user"}
                className="h-9 w-9 rounded-full object-cover border border-black/10 dark:border-white/10"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10" />
            )}
            <div>
              <div className="font-semibold text-zinc-900 dark:text-zinc-50">{u.name ?? "이름 미등록"}</div>
              <div className="text-xs text-zinc-600 dark:text-zinc-300">{u.email ?? "no-email"}</div>
            </div>
          </div>
        ),
      },
      {
        key: "appId",
        header: "앱",
        cell: (u) => (
          <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
            {u.registeredAppId ?? "-"}
          </span>
        ),
      },
      {
        key: "requestedAt",
        header: "가입 요청",
        cell: (u) => (
          <span className="text-xs text-zinc-600 dark:text-zinc-300">
            {new Date(u.createdAt).toLocaleString()}
          </span>
        ),
      },
      {
        key: "actions",
        header: "처리",
        cell: (u) => (
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => act(u.id, "approve")}
              disabled={isLoading}
              className="h-9 rounded-xl px-3 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-600/90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              승인
            </button>
            <button
              type="button"
              onClick={() => act(u.id, "reject")}
              disabled={isLoading}
              className="h-9 rounded-xl px-3 text-xs font-semibold bg-rose-600 text-white hover:bg-rose-600/90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              거절
            </button>
          </div>
        ),
      },
    ],
    [act, isLoading]
  );

  return (
    <div className="w-full">
      <div className="mb-5 flex items-center gap-3 flex-wrap">
        <div>
          <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">앱 필터</label>
          <select
            value={selectedAppId}
            onChange={onChangeApp}
            className="mt-1 h-10 rounded-xl border border-black/10 dark:border-white/15 bg-white/60 dark:bg-white/5 px-3 text-sm"
          >
            <option value="ALL">전체(PENDING)</option>
            {appOptions.map((appId) => (
              <option key={appId} value={appId}>
                {appId}
              </option>
            ))}
          </select>
        </div>

        <div className="text-sm text-zinc-600 dark:text-zinc-300">
          표시: <span className="font-semibold">{users.length}</span>명
        </div>
      </div>

      <DataTable
        rows={users}
        columns={columns}
        getRowKey={(row) => row.id}
        emptyMessage="해당 조건의 승인 대기 사용자가 없습니다."
      />
    </div>
  );
}

