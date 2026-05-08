"use client";

import { useState } from "react";
import Link from "next/link";
import { type AppRole } from "@prisma/client";
import { api } from "~/trpc/react";
import { UserMenu } from "~/app/_components/UserMenu";

const roleLabel: Record<AppRole, string> = {
  SUPER_ADMIN: "全管理者",
  TENANT_ADMIN: "テナント管理者",
  MEMBER: "一般ユーザー",
  VIEWER: "閲覧者",
};

const manageableRoles = ["TENANT_ADMIN", "MEMBER", "VIEWER"] as const;

type EditingMember = {
  id: string;
  email: string;
  name: string;
  password: string;
  role: (typeof manageableRoles)[number];
};

export default function SettingsPage() {
  const utils = api.useUtils();
  const { data, isLoading, error } = api.tenant.current.useQuery();
  const [message, setMessage] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({
    email: "",
    name: "",
    password: "",
    role: "MEMBER" as (typeof manageableRoles)[number],
  });
  const [editing, setEditing] = useState<EditingMember | null>(null);

  const canManage =
    data?.role === "SUPER_ADMIN" || data?.role === "TENANT_ADMIN";

  const refresh = async () => {
    await utils.tenant.current.invalidate();
  };

  const createMember = api.tenant.createMember.useMutation({
    onSuccess: async () => {
      setNewUser({ email: "", name: "", password: "", role: "MEMBER" });
      setMessage("ユーザーを追加しました");
      await refresh();
    },
    onError: (e) => setMessage(e.message),
  });

  const updateMember = api.tenant.updateMember.useMutation({
    onSuccess: async () => {
      setEditing(null);
      setMessage("ユーザーを更新しました");
      await refresh();
    },
    onError: (e) => setMessage(e.message),
  });

  const removeMember = api.tenant.removeMember.useMutation({
    onSuccess: async () => {
      setMessage("ユーザーをテナントから削除しました");
      await refresh();
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
              自テナントに紐づくユーザーを管理
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
                    テナント
                  </h2>
                  <p className="mt-1 text-xl font-semibold text-gray-900">
                    {tenant.name}
                  </p>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                  あなた: {roleLabel[data.role]}
                </span>
              </div>
            </section>

            <section className="rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
                  ユーザー
                </h2>
                <span className="text-sm text-gray-500">
                  {tenant.members.length}人
                </span>
              </div>

              {canManage && (
                <div className="mb-5 grid gap-2 rounded-lg bg-gray-50 p-3 md:grid-cols-[1fr_1fr_1fr_auto_auto]">
                  <input
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="メール"
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
                  />
                  <input
                    value={newUser.name}
                    onChange={(e) =>
                      setNewUser((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="名前"
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
                  />
                  <input
                    value={newUser.password}
                    onChange={(e) =>
                      setNewUser((prev) => ({
                        ...prev,
                        password: e.target.value,
                      }))
                    }
                    placeholder="初期パスワード"
                    type="password"
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
                  />
                  <select
                    value={newUser.role}
                    onChange={(e) =>
                      setNewUser((prev) => ({
                        ...prev,
                        role: e.target.value as typeof newUser.role,
                      }))
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
                    onClick={() => createMember.mutate(newUser)}
                    disabled={
                      createMember.isPending ||
                      !newUser.email.trim() ||
                      newUser.password.length < 8
                    }
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
                      <th className="pr-4 pb-2 font-normal">メール</th>
                      <th className="pr-4 pb-2 font-normal">名前</th>
                      <th className="pr-4 pb-2 font-normal">ロール</th>
                      <th className="pb-2 font-normal">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenant.members.map((member) => {
                      const isEditing = editing?.id === member.id;
                      return (
                        <tr key={member.id} className="border-b last:border-0">
                          <td className="py-3 pr-4">
                            {isEditing ? (
                              <input
                                value={editing.email}
                                onChange={(e) =>
                                  setEditing((prev) =>
                                    prev
                                      ? { ...prev, email: e.target.value }
                                      : prev,
                                  )
                                }
                                className="w-56 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                              />
                            ) : (
                              <span className="font-medium text-gray-800">
                                {member.user.email}
                              </span>
                            )}
                          </td>
                          <td className="py-3 pr-4">
                            {isEditing ? (
                              <input
                                value={editing.name}
                                onChange={(e) =>
                                  setEditing((prev) =>
                                    prev
                                      ? { ...prev, name: e.target.value }
                                      : prev,
                                  )
                                }
                                className="w-40 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                              />
                            ) : (
                              <span className="text-gray-600">
                                {member.user.name ?? "-"}
                              </span>
                            )}
                          </td>
                          <td className="py-3 pr-4">
                            {isEditing ? (
                              <select
                                value={editing.role}
                                onChange={(e) =>
                                  setEditing((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          role: e.target
                                            .value as EditingMember["role"],
                                        }
                                      : prev,
                                  )
                                }
                                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
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
                                <div className="flex flex-wrap gap-2">
                                  {isEditing ? (
                                    <>
                                      <input
                                        value={editing.password}
                                        onChange={(e) =>
                                          setEditing((prev) =>
                                            prev
                                              ? {
                                                  ...prev,
                                                  password: e.target.value,
                                                }
                                              : prev,
                                          )
                                        }
                                        placeholder="新PW 空なら維持"
                                        type="password"
                                        className="w-36 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateMember.mutate({
                                            memberId: editing.id,
                                            email: editing.email,
                                            name: editing.name,
                                            password: editing.password,
                                            role: editing.role,
                                          })
                                        }
                                        className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white"
                                      >
                                        保存
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditing(null)}
                                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500"
                                      >
                                        取消
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setEditing({
                                            id: member.id,
                                            email: member.user.email,
                                            name: member.user.name ?? "",
                                            password: "",
                                            role:
                                              member.role === "SUPER_ADMIN"
                                                ? "TENANT_ADMIN"
                                                : member.role,
                                          })
                                        }
                                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
                                      >
                                        編集
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (
                                            confirm(
                                              `${member.user.email} をこのテナントから削除しますか？`,
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
                                    </>
                                  )}
                                </div>
                              )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
