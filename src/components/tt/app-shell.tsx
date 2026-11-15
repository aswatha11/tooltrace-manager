import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  PlusCircle,
  ScanLine,
  Settings,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/queries";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof Wrench; adminOnly?: boolean };

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/update", label: "Update Status", icon: ScanLine },
  { to: "/tools", label: "Tools & History", icon: Wrench },
  { to: "/tools/new", label: "Add Tool", icon: PlusCircle },
  { to: "/reports", label: "Reports", icon: FileSpreadsheet },
  { to: "/alerts", label: "Delay Alerts", icon: AlertTriangle },
  { to: "/settings", label: "Settings", icon: Settings, adminOnly: true },
];

const MOBILE_NAV: NavItem[] = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/tools", label: "Tools", icon: Wrench },
  { to: "/update", label: "Update", icon: ScanLine },
  { to: "/reports", label: "Reports", icon: FileSpreadsheet },
  { to: "/alerts", label: "Alerts", icon: AlertTriangle },
];

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="grid size-9 place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-elevated">
        <BarChart3 className="size-5" />
      </div>
      <div className="leading-none">
        <p className="font-display text-xl font-bold tracking-wide">ToolTrace</p>
        <p className="text-[10px] font-semibold tracking-[0.18em] uppercase opacity-60">Tooling traceability</p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { redirect: undefined }, replace: true });
  };

  const items = NAV.filter((n) => !n.adminOnly || me?.role === "admin");

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="border-b border-sidebar-border px-5 py-5">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/tools" }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "bg-sidebar-accent !text-sidebar-accent-foreground shadow-inner" }}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-full bg-sidebar-primary font-bold text-sidebar-primary-foreground">
              {me?.name.charAt(0).toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{me?.name ?? "…"}</p>
              <p className="text-xs tracking-wider text-sidebar-foreground/60 uppercase">{me?.role ?? ""}</p>
            </div>
            <ThemeToggle className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-sidebar px-4 py-3 text-sidebar-foreground lg:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          <Link
            to="/tools/new"
            className="grid size-9 place-items-center rounded-md hover:bg-sidebar-accent"
            aria-label="Add tool"
          >
            <PlusCircle className="size-5" />
          </Link>
          {me?.role === "admin" && (
            <Link to="/settings" className="grid size-9 place-items-center rounded-md hover:bg-sidebar-accent" aria-label="Settings">
              <Settings className="size-5" />
            </Link>
          )}
          <ThemeToggle className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
          <button onClick={signOut} className="grid size-9 place-items-center rounded-md hover:bg-sidebar-accent" aria-label="Sign out">
            <LogOut className="size-5" />
          </button>
        </div>
      </header>

      <main className="bg-blueprint min-h-screen pb-28 lg:ml-64 lg:pb-10">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card/95 backdrop-blur lg:hidden">
        {MOBILE_NAV.map((item) => {
          const center = item.to === "/update";
          return (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/tools" }}
              className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold text-muted-foreground"
              activeProps={{ className: "!text-primary" }}
            >
              {center ? (
                <span className="-mt-7 grid size-14 place-items-center rounded-full bg-gradient-primary text-primary-foreground shadow-elevated ring-4 ring-background">
                  <item.icon className="size-6" />
                </span>
              ) : (
                <item.icon className="size-6" />
              )}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
