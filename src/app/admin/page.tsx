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

const allRoles = ["SUPER_ADMIN", "TENANT_ADMIN", "MEMBER", "VIEWER"] as const;

const formatDate = (date: Date) =>
  new Date(date).toLocaleString("ja-JP", {
    dateStyle: "short",
    timeStyle: "short",
  });

type EditingTenant = {
  id: string;
  name: string;
};

type EditingMember = {
  id: string;
  email: string;
  name: string;
  password: string;
  role: AppRole;
};

export default function AdminPage() {
  const utils = api.useUtils();
  const { data, isLoading, error } = api.admin.overview.useQuery();
  const [message, setMessage] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState("");
  const [editingTenant, setEditingTenant] = useState<EditingTenant | null>(
    null,
  );
  const [editingMember, setEditingMember] = useState<EditingMember | null>(
    null,
  );
  const [newUsers, setNewUsers] = useState<
    Record<
      string,
      { email: string; name: string; password: string; role: AppRole }
    >
  >({});

  const refresh = async () => {
    await utils.admin.overview.invalidate();
  };

  const createTenant = api.admin.createTenant.useMutation({
    onSuccess: async () => {
      setTenantName("");
      setMessage("テナントを追加しました");
      await refresh();
    },
    onError: (e) => setMessage(e.message),
  });

  const updateTenant = api.admin.updateTenant.useMutation({
    onSuccess: async () => {
      setEditingTenant(null);
      setMessage("テナントを更新しました");
      await refresh();
    },
    onError: (e) => setMessage(e.message),
  });

  const deleteTenant = api.admin.deleteTenant.useMutation({
    onSuccess: async () => {
      setMessage("テナントを削除しました");
      await refresh();
    },
    onError: (e) => setMessage(e.message),
  });

  const createMember = api.admin.createTenantMember.useMutation({
    onSuccess: async (_, variables) => {
      setNewUsers((prev) => ({
        ...prev,
        [variables.tenantId]: {
          email: "",
          name: "",
          password: "",
          role: "MEMBER",
        },
      }));
      setMessage("ユーザーを追加しました");
      await refresh();
    },
    onError: (e) => setMessage(e.message),
  });

  const updateMember = api.admin.updateTenantMember.useMutation({
    onSuccess: async () => {
      setEditingMember(null);
      setMessage("ユーザーを更新しました");
      await refresh();
    },
    onError: (e) => setMessage(e.message),
  });

  const removeMember = api.admin.removeTenantMember.useMutation({
    onSuccess: async () => {
      setMessage("ユーザーをテナントから削除しました");
      await refresh();
    },
    onError: (e) => setMessage(e.message),
  });

  const setNewUser = (
    tenantId: string,
    patch: Partial<{
      email: string;
      name: string;
      password: string;
      role: AppRole;
    }>,
  ) => {
    setNewUsers((prev) => ({
      ...prev,
      [tenantId]: {
        email: "",
        name: "",
        password: "",
        role: "MEMBER",
        ...prev[tenantId],
        ...patch,
      },
    }));
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              全管理
            </h1>
            <p className="text-sm text-gray-500">
              テナントと紐づくユーザーを管理
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              テナント管理
            </Link>
            <Link
              href="/"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              新規解析
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

        {data && (
          <div className="space-y-4">
            {message && (
              <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-700">
                {message}
              </div>
            )}

            <section className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-white p-5 shadow-sm">
                <p className="text-xs text-gray-400">テナント</p>
                <p className="mt-1 text-3xl font-semibold text-gray-900">
                  {data.tenants.length}
                </p>
              </div>
              <div className="rounded-xl bg-white p-5 shadow-sm">
                <p className="text-xs text-gray-400">ユーザー</p>
                <p className="mt-1 text-3xl font-semibold text-gray-900">
                  {data.usersCount}
                </p>
              </div>
              <div className="rounded-xl bg-white p-5 shadow-sm">
                <p className="text-xs text-gray-400">利用イベント</p>
                <p className="mt-1 text-3xl font-semibold text-gray-900">
                  {data.usageByAction.reduce(
                    (sum, item) => sum + item._count._all,
                    0,
                  )}
                </p>
              </div>
            </section>

            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xs font-semibold tracking-wide text-gray-400 uppercase">
                テナント追加
              </h2>
              <div className="flex flex-wrap gap-2">
                <input
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  placeholder="テナント名"
                  className="min-w-72 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
                />
                <button
                  type="button"
                  onClick={() => createTenant.mutate({ name: tenantName })}
                  disabled={createTenant.isPending || !tenantName.trim()}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  追加
                </button>
              </div>
            </section>

            {data.tenants.map((tenant) => {
              const newUser = newUsers[tenant.id] ?? {
                email: "",
                name: "",
                password: "",
                role: "MEMBER" as AppRole,
              };
              const tenantEditing = editingTenant?.id === tenant.id;

              return (
                <section
                  key={tenant.id}
                  className="rounded-xl bg-white p-6 shadow-sm"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
                        テナント
                      </h2>
                      {tenantEditing ? (
                        <input
                          value={editingTenant.name}
                          onChange={(e) =>
                            setEditingTenant((prev) =>
                              prev ? { ...prev, name: e.target.value } : prev,
                            )
                          }
                          className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-xl font-semibold text-gray-900"
                        />
                      ) : (
                        <p className="mt-1 text-xl font-semibold text-gray-900">
                          {tenant.name}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-400">
                        作成日 {formatDate(tenant.createdAt)} / 図面{" "}
                        {tenant._count.surveyMaps} / 利用{" "}
                        {tenant._count.usageEvents}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {tenantEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              updateTenant.mutate({
                                tenantId: editingTenant.id,
                                name: editingTenant.name,
                              })
                            }
                            className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white"
                          >
                            保存
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTenant(null)}
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
                              setEditingTenant({
                                id: tenant.id,
                                name: tenant.name,
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
                                  `${tenant.name} を削除しますか？図面や所属も削除されます。`,
                                )
                              ) {
                                deleteTenant.mutate({ tenantId: tenant.id });
                              }
                            }}
                            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-red-50 hover:text-red-600"
                          >
                            削除
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mb-5 grid gap-2 rounded-lg bg-gray-50 p-3 md:grid-cols-[1fr_1fr_1fr_auto_auto]">
                    <input
                      value={newUser.email}
                      onChange={(e) =>
                        setNewUser(tenant.id, { email: e.target.value })
                      }
                      placeholder="メール"
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    <input
                      value={newUser.name}
                      onChange={(e) =>
                        setNewUser(tenant.id, { name: e.target.value })
                      }
                      placeholder="名前"
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    <input
                      value={newUser.password}
                      onChange={(e) =>
                        setNewUser(tenant.id, { password: e.target.value })
                      }
                      placeholder="初期パスワード"
                      type="password"
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    <select
                      value={newUser.role}
                      onChange={(e) =>
                        setNewUser(tenant.id, {
                          role: e.target.value as AppRole,
                        })
                      }
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                    >
                      {allRoles.map((role) => (
                        <option key={role} value={role}>
                          {roleLabel[role]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        createMember.mutate({
                          tenantId: tenant.id,
                          ...newUser,
                        })
                      }
                      disabled={
                        createMember.isPending ||
                        !newUser.email.trim() ||
                        newUser.password.length < 8
                      }
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      ユーザー追加
                    </button>
                  </div>

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
                          const isEditing = editingMember?.id === member.id;
                          return (
                            <tr
                              key={member.id}
                              className="border-b last:border-0"
                            >
                              <td className="py-3 pr-4">
                                {isEditing ? (
                                  <input
                                    value={editingMember.email}
                                    onChange={(e) =>
                                      setEditingMember((prev) =>
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
                                    value={editingMember.name}
                                    onChange={(e) =>
                                      setEditingMember((prev) =>
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
                                    value={editingMember.role}
                                    onChange={(e) =>
                                      setEditingMember((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              role: e.target.value as AppRole,
                                            }
                                          : prev,
                                      )
                                    }
                                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                                  >
                                    {allRoles.map((role) => (
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
                                <div className="flex flex-wrap gap-2">
                                  {isEditing ? (
                                    <>
                                      <input
                                        value={editingMember.password}
                                        onChange={(e) =>
                                          setEditingMember((prev) =>
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
                                            memberId: editingMember.id,
                                            email: editingMember.email,
                                            name: editingMember.name,
                                            password: editingMember.password,
                                            role: editingMember.role,
                                          })
                                        }
                                        className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white"
                                      >
                                        保存
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingMember(null)}
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
                                          setEditingMember({
                                            id: member.id,
                                            email: member.user.email,
                                            name: member.user.name ?? "",
                                            password: "",
                                            role: member.role,
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
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}

            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xs font-semibold tracking-wide text-gray-400 uppercase">
                監査ログ
              </h2>
              <div className="space-y-2">
                {data.recentAuditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {log.action}
                      </p>
                      <p className="text-xs text-gray-400">
                        {log.tenant?.name ?? "テナントなし"} /{" "}
                        {log.user?.email ?? "ユーザーなし"}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {formatDate(log.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
