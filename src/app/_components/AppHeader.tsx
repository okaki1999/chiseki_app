"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { api } from "~/trpc/react";
import { UserMenu } from "~/app/_components/UserMenu";

type HeaderAction = {
  href?: string;
  label: string;
  variant?: "primary" | "plain";
  onClick?: () => void;
  disabled?: boolean;
};

type Props = {
  title: string;
  subtitle?: string;
  maxWidth?: string;
  actions?: HeaderAction[];
  children?: ReactNode;
};

const canManageTenant = (role?: string) =>
  role === "SUPER_ADMIN" || role === "TENANT_ADMIN";

export function AppHeader({
  title,
  subtitle,
  maxWidth = "max-w-4xl",
  actions = [],
  children,
}: Props) {
  const { data } = api.tenant.session.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return (
    <header
      className={`mx-auto mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between ${maxWidth}`}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight break-words text-gray-900 sm:text-3xl">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end sm:gap-3">
        {actions.map((action) =>
          action.href ? (
            <Link
              key={`${action.label}-${action.href}`}
              href={action.href}
              className={
                action.variant === "primary"
                  ? "rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium whitespace-nowrap text-white hover:bg-blue-700 sm:px-4"
                  : "text-sm whitespace-nowrap text-gray-500 hover:text-gray-700"
              }
            >
              {action.label}
            </Link>
          ) : (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium whitespace-nowrap text-white hover:bg-blue-700 disabled:opacity-60 sm:px-4"
            >
              {action.label}
            </button>
          ),
        )}
        {canManageTenant(data?.role) && (
          <Link
            href={data?.role === "SUPER_ADMIN" ? "/admin" : "/settings"}
            className="text-sm whitespace-nowrap text-gray-500 hover:text-gray-700"
          >
            管理
          </Link>
        )}
        {children}
        <UserMenu />
      </div>
    </header>
  );
}
