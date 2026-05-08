"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { UserMenu } from "~/app/_components/UserMenu";

const roleLabel = {
  SUPER_ADMIN: "全管理者",
  TENANT_ADMIN: "テナント管理者",
  MEMBER: "一般ユーザー",
  VIEWER: "閲覧者",
} as const;

const manageableRoles = ["TENANT_ADMIN", "MEMBER", "VIEWER"] as const;

export default function SettingsPage() {
  const utils = api.useUtils();
  const { data, isLoading, error } = api.tenant.current.useQuery();
  const [tenantName, setTenantName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] =
    useState<(typeof manageableRoles)[number]>("MEMBER");
  const [message, setMessage] = useState<string | null>(null);

  const canManage =
    data?.role === "SUPER_ADMIN" || data?.role === "TENANT_ADMIN";

  const updateName = api.tenant.updateName.useMutation({
    onSuccess: async () => {
      setMessage("テナント名を更新しました");
      await utils.tenant.current.invalidate();
    },
    onError: (e) => setMessage(e.message),
  });

  const addMember = api.tenant.addMemberByEmail.useMutation({
    onSuccess: async () => {
      setInviteEmail("");
      setMessage("メンバーを追加しました");
      await utils.tenant.current.invalidate();
    },
    onError: (e) => setMessage(e.message),
  });

  const updateRole = api.tenant.updateMemberRole.useMutation({
    onSuccess: async () => {
      setMessage("ロールを更新しました");
      await utils.tenant.current.invalidate();
    },
    onError: (e) => setMessage(e.message),
  });

  const removeMember = api.tenant.removeMember.useMutation({
    onSuccess: async () => {
      setMessage("メンバーを削除しました");
      await utils.tenant.current.invalidate();
    },
    onError: (e) => setMessage(e.message),
  });

  const tenant = data?.tenant;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              テナント管理
            </h1>
            <p className="text-sm text-gray-500">
              メンバー、ロール、利用状況を管理
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              新規解析
            </Link>
            <Link
              href="/history"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              履歴
            </Link>
            <UserMenu />
          </div>
        </div>

        {isLoading && (
          <div className="rounded-xl bg-white p-8 text-sm text-gray-400 shadow-sm">
            読み込み中...
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error.message}
          </div>
        )}

        {tenant && (
          <div className="space-y-4">
            {message && (
              <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-700">
                {message}
              </div>
            )}

            <section className="rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
                    組織
                  </h2>
                  <p className="mt-1 text-xl font-semibold text-gray-900">
                    {tenant.name}
                  </p>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                  あなた: {roleLabel[data.role]}
                </span>
              </div>

              {canManage && (
                <div className="flex flex-wrap gap-2">
                  <input
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    placeholder={tenant.name}
                    className="min-w-64 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateName.mutate({
                        name: tenantName.trim() || tenant.name,
                      })
                    }
                    disabled={updateName.isPending}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    更新
                  </button>
                </div>
              )}
            </section>

            <section className="rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
                  メンバー
                </h2>
                <span className="text-sm text-gray-500">
                  {tenant.members.length}人
                </span>
              </div>

              {canManage && (
                <div className="mb-5 flex flex-wrap gap-2 rounded-lg bg-gray-50 p-3">
                  <input
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="追加するユーザーのメール"
                    className="min-w-72 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(
                        e.target.value as (typeof manageableRoles)[number],
                      )
                    }
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                  >
                    {manageableRoles.map((role) => (
                      <option key={role} value={role}>
                        {roleLabel[role]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      addMember.mutate({
                        email: inviteEmail.trim(),
                        role: inviteRole,
                      })
                    }
                    disabled={addMember.isPending || !inviteEmail.trim()}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    追加
                  </button>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-400">
                      <th className="pr-4 pb-2 font-normal">ユーザー</th>
                      <th className="pr-4 pb-2 font-normal">ロール</th>
                      <th className="pb-2 font-normal">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenant.members.map((member) => (
                      <tr key={member.id} className="border-b last:border-0">
                        <td className="py-3 pr-4">
                          <p className="font-medium text-gray-800">
                            {member.user.name ?? member.user.email}
                          </p>
                          <p className="text-xs text-gray-400">
                            {member.user.email}
                          </p>
                        </td>
                        <td className="py-3 pr-4">
                          {canManage &&
                          member.role !== "SUPER_ADMIN" &&
                          member.userId !== data.currentUserId ? (
                            <select
                              value={member.role}
                              onChange={(e) =>
                                updateRole.mutate({
                                  memberId: member.id,
                                  role: e.target
                                    .value as (typeof manageableRoles)[number],
                                })
                              }
                              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                            >
                              {manageableRoles.map((role) => (
                                <option key={role} value={role}>
                                  {roleLabel[role]}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                              {roleLabel[member.role]}
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          {canManage &&
                            member.userId !== data.currentUserId && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    confirm(
                                      `${member.user.email} を削除しますか？`,
                                    )
                                  ) {
                                    removeMember.mutate({
                                      memberId: member.id,
                                    });
                                  }
                                }}
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-red-50 hover:text-red-600"
                              >
                                削除
                              </button>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xs font-semibold tracking-wide text-gray-400 uppercase">
                利用状況
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-xs text-gray-400">保存図面</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">
                    {tenant._count.surveyMaps}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-xs text-gray-400">利用イベント</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">
                    {tenant._count.usageEvents}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-xs text-gray-400">メンバー</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">
                    {tenant.members.length}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {data.usageByAction.map((item) => (
                  <span
                    key={item.action}
                    className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700"
                  >
                    {item.action}: {item._count._all}
                  </span>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
