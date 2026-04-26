"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { UserRole } from "@/types";

export function Navbar() {
  const { userDoc, role, loading, logout } = useAuth();

  const dashboardHref =
    role === UserRole.SUPER_ADMIN
      ? "/admin"
      : role === UserRole.FIELD_AGENT
      ? "/agent"
      : "/dashboard";

  return (
    <header className="h-14 bg-[#333a8b] text-white flex items-center px-6 shadow-sm">
      <Link href={dashboardHref} className="flex items-center gap-3 font-bold text-lg tracking-tight">
        <Image
          src="/DMA_logo.png"
          alt="DMA Logo"
          width={40}
          height={40}
          className="rounded-[10px]"
        />
        <div className="hidden sm:flex flex-col">
          <span className="text-[#ff6900] text-base">Swifora</span>
          <span className="text-white/70 font-normal text-xs">DMA Platform</span>
        </div>
      </Link>

      <nav className="ml-auto flex items-center gap-4">
        {!loading && userDoc && (
          <>
            <span className="text-sm text-white/70 hidden sm:block">
              {userDoc.displayName}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="border-white/30 text-white hover:bg-white/10 hover:text-white"
            >
              Sign out
            </Button>
          </>
        )}
      </nav>
    </header>
  );
}
