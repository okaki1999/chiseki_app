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
  const { data } = api.tenant.current.useQuery();

  return (
    <header
      className={`mx-auto mb-8 flex items-end justify-between ${maxWidth}`}
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {actions.map((action) =>
          action.href ? (
            <Link
              key={`${action.label}-${action.href}`}
              href={action.href}
              className={
                action.variant === "primary"
                  ? "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  : "text-sm text-gray-500 hover:text-gray-700"
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
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {action.label}
            </button>
          ),
        )}
        {canManageTenant(data?.role) && (
          <Link
            href={data?.role === "SUPER_ADMIN" ? "/admin" : "/settings"}
            className="text-sm text-gray-500 hover:text-gray-700"
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
