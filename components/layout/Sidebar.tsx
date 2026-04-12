"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ClipboardList,
  Building2,
  HelpCircle,
  LogOut,
  LayoutDashboard,
  Users,
  BookOpen,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { getCompany } from "@/lib/firebase/firestore";
import { UserRole } from "@/types";

const companyNavItems = [
  { label: "Dashboard",       href: "/dashboard",      icon: Home },
  { label: "Assessments",     href: "/dashboard",      icon: ClipboardList },
  { label: "Company Profile", href: "/company-setup",  icon: Building2 },
  { label: "Help",            href: "/help",            icon: HelpCircle },
];

const adminNavItems = [
  { label: "Overview",    href: "/admin",            icon: LayoutDashboard },
  { label: "Companies",   href: "/admin/companies",  icon: Building2 },
  { label: "Agents",      href: "/admin/agents",     icon: Users },
  { label: "GRI Topics",  href: "/admin/topics",     icon: BookOpen },
];

export function Sidebar() {
  const pathname = usePathname();
  const { firebaseUser, userDoc, role, logout } = useAuth();
  const [companyName, setCompanyName] = useState<string | null>(null);

  const isSuperAdmin = role === UserRole.SUPER_ADMIN;

  useEffect(() => {
    if (isSuperAdmin || !firebaseUser?.uid) return;
    getCompany(firebaseUser.uid)
      .then((c) => { if (c) setCompanyName(c.name); })
      .catch(() => {});
  }, [firebaseUser?.uid, isSuperAdmin]);

  const navItems = isSuperAdmin ? adminNavItems : companyNavItems;

  function isActive(href: string): boolean {
    if (isSuperAdmin) {
      // Exact match for /admin (overview), prefix for sub-pages
      return href === "/admin"
        ? pathname === "/admin"
        : pathname === href || pathname.startsWith(href + "/");
    }
    return href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="w-[220px] h-full bg-white border-r border-border flex flex-col">
      {/* Header identity */}
      <div className="px-4 py-5 border-b border-border">
        {isSuperAdmin ? (
          <>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck size={13} className="text-[#ff6900] shrink-0" />
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Super Admin
              </p>
            </div>
            <p className="text-sm font-semibold text-[#333a8b] truncate">
              {userDoc?.displayName ?? "Admin"}
            </p>
          </>
        ) : (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              Company
            </p>
            <p className="text-sm font-semibold text-[#333a8b] truncate">
              {companyName ?? userDoc?.displayName ?? "Loading…"}
            </p>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all border-l-[3px]",
                active
                  ? "border-[#333a8b] bg-[#eff2ff] text-[#333a8b]"
                  : "border-transparent text-[#6b7280] hover:bg-gray-50 hover:text-[#333a8b]"
              )}
            >
              <Icon
                size={16}
                strokeWidth={active ? 2.5 : 2}
                className={active ? "text-[#333a8b]" : "text-[#9ca3af]"}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-3 border-t border-border">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm font-medium border-l-[3px] border-transparent text-[#6b7280] hover:bg-red-50 hover:text-red-600 transition-all"
        >
          <LogOut size={16} className="text-[#9ca3af]" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
