"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

const linkClass =
  "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium whitespace-nowrap text-gray-600 hover:bg-gray-50";

const activeLinkClass =
  "rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-medium whitespace-nowrap text-blue-700";

const primaryButtonClass =
  "rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium whitespace-nowrap text-white hover:bg-blue-700 disabled:opacity-60 sm:px-4";

export function AppHeader({
  title,
  subtitle,
  maxWidth = "max-w-4xl",
  actions = [],
  children,
}: Props) {
  const pathname = usePathname();
  const { data } = api.tenant.session.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const managementHref = data?.role === "SUPER_ADMIN" ? "/admin" : "/settings";
  const navItems = [
    { href: "/", label: "新規解析", show: true },
    { href: "/history", label: "履歴", show: true },
    { href: managementHref, label: "管理", show: canManageTenant(data?.role) },
  ];

  return (
    <header
      className={`mx-auto mb-6 flex min-h-20 flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between ${maxWidth}`}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight break-words text-gray-900 sm:text-3xl">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end sm:gap-3">
        {navItems
          .filter((item) => item.show)
          .map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={isActive ? activeLinkClass : linkClass}
              >
                {item.label}
              </Link>
            );
          })}
        {actions.map((action) =>
          action.href ? (
            <Link
              key={`${action.label}-${action.href}`}
              href={action.href}
              className={linkClass}
            >
              {action.label}
            </Link>
          ) : (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              className={
                action.variant === "plain" ? linkClass : primaryButtonClass
              }
            >
              {action.label}
            </button>
          ),
        )}
        {children}
        <UserMenu />
      </div>
    </header>
  );
}
