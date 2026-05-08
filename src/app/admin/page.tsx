"use client";

import Link from "next/link";
import { api } from "~/trpc/react";
import { UserMenu } from "~/app/_components/UserMenu";

const formatDate = (date: Date) =>
  new Date(date).toLocaleString("ja-JP", {
    dateStyle: "short",
    timeStyle: "short",
  });

export default function AdminPage() {
  const { data, isLoading, error } = api.admin.overview.useQuery();

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              全管理
            </h1>
            <p className="text-sm text-gray-500">
              テナント、利用状況、監査ログ
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
                利用内訳
              </h2>
              <div className="flex flex-wrap gap-2">
                {data.usageByAction.length === 0 && (
                  <span className="text-sm text-gray-400">
                    まだ利用記録がありません
                  </span>
                )}
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

            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xs font-semibold tracking-wide text-gray-400 uppercase">
                テナント
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-400">
                      <th className="pr-4 pb-2 font-normal">名前</th>
                      <th className="pr-4 pb-2 text-right font-normal">
                        メンバー
                      </th>
                      <th className="pr-4 pb-2 text-right font-normal">図面</th>
                      <th className="pr-4 pb-2 text-right font-normal">利用</th>
                      <th className="pb-2 font-normal">作成日</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tenants.map((tenant) => (
                      <tr key={tenant.id} className="border-b last:border-0">
                        <td className="py-3 pr-4 font-medium text-gray-800">
                          {tenant.name}
                        </td>
                        <td className="py-3 pr-4 text-right text-gray-600">
                          {tenant._count.members}
                        </td>
                        <td className="py-3 pr-4 text-right text-gray-600">
                          {tenant._count.surveyMaps}
                        </td>
                        <td className="py-3 pr-4 text-right text-gray-600">
                          {tenant._count.usageEvents}
                        </td>
                        <td className="py-3 text-gray-500">
                          {formatDate(tenant.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xs font-semibold tracking-wide text-gray-400 uppercase">
                監査ログ
              </h2>
              <div className="space-y-2">
                {data.recentAuditLogs.length === 0 && (
                  <p className="text-sm text-gray-400">まだログがありません</p>
                )}
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
