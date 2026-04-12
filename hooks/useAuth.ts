"use client";

import { useRouter } from "next/navigation";
import { logOut } from "@/lib/firebase/auth";
import { useAuthStore } from "@/store/authStore";
import { UserRole } from "@/types";

/**
 * Read-only view of the auth state populated by AuthProvider.
 * Exposes `logout` for sign-out actions anywhere in the app.
 */
export function useAuth() {
  const router = useRouter();
  const { firebaseUser, userDoc, role, loading } = useAuthStore();

  async function logout() {
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
    } catch { /* non-fatal */ }
    await logOut();
    router.push("/login");
  }

  return { firebaseUser, userDoc, role, loading, logout };
}

export function useRequireRole(requiredRole: UserRole) {
  const { role, loading } = useAuth();
  return {
    authorized: role === requiredRole,
    loading,
  };
}
