"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
  Briefcase,
  UserCheck,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { getCompany } from "@/lib/firebase/firestore";
import { UserRole } from "@/types";

const companyNavItems = [
  { label: "Dashboard",       href: "/dashboard",           icon: Home },
  { label: "Assessments",     href: "/dashboard",           icon: ClipboardList },
  { label: "Field Agents",    href: "/dashboard/agents",    icon: UserCog },
  { label: "Company Profile", href: "/company-profile",     icon: Building2 },
  { label: "Help",            href: "/help",                icon: HelpCircle },
];

const adminNavItems = [
  { label: "Overview",    href: "/admin",            icon: LayoutDashboard },
  { label: "Companies",   href: "/admin/companies",  icon: Building2 },
  { label: "Agents",      href: "/admin/agents",     icon: Users },
  { label: "GRI Topics",  href: "/admin/topics",     icon: BookOpen },
];

const agentNavItems = [
  { label: "Dashboard",    href: "/agent",              icon: LayoutDashboard },
  { label: "Assignments",  href: "/agent/assignments",  icon: UserCheck },
];

export function Sidebar() {
  const pathname = usePathname();
  const { firebaseUser, userDoc, role, logout } = useAuth();
  const [companyName, setCompanyName] = useState<string | null>(null);

  const isSuperAdmin = role === UserRole.SUPER_ADMIN;
  const isFieldAgent = role === UserRole.FIELD_AGENT;

  useEffect(() => {
    if (isSuperAdmin || isFieldAgent || !firebaseUser?.uid) return;
    getCompany(firebaseUser.uid)
      .then((c) => { if (c) setCompanyName(c.name); })
      .catch(() => {});
  }, [firebaseUser?.uid, isSuperAdmin, isFieldAgent]);

  const navItems = isSuperAdmin
    ? adminNavItems
    : isFieldAgent
    ? agentNavItems
    : companyNavItems;

  function isActive(href: string): boolean {
    if (href === "/admin")       return pathname === "/admin";
    if (href === "/agent")       return pathname === "/agent";
    if (href === "/dashboard")   return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="w-[220px] h-full bg-white border-r border-border flex flex-col">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-border flex items-center justify-center">
        <Image
          src="/DMA_logo.png"
          alt="DMA Logo"
          width={50}
          height={50}
        />
      </div>
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
        ) : isFieldAgent ? (
          <>
            <div className="flex items-center gap-2 mb-1">
              <Briefcase size={13} className="text-[#ff6900] shrink-0" />
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Field Agent
              </p>
            </div>
            <p className="text-sm font-semibold text-[#333a8b] truncate">
              {userDoc?.displayName ?? "Agent"}
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
