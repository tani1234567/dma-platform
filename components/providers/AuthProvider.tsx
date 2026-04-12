"use client";

import { useEffect, useRef } from "react";
import { onAuthChange } from "@/lib/firebase/auth";
import { getUserDocument } from "@/lib/firebase/firestore";
import { useAuthStore } from "@/store/authStore";
import { UserRole } from "@/types";

/** Mounts exactly one onAuthStateChanged listener for the entire app. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialized = useRef(false);
  const { setFirebaseUser, setUserDoc, setRole, setLoading, reset } = useAuthStore();

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const unsubscribe = onAuthChange(async (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser);
        const userDoc = await getUserDocument(fbUser.uid).catch(() => null);
        let claimRole: UserRole | undefined;
        try {
          const tokenResult = await fbUser.getIdTokenResult();
          claimRole = tokenResult.claims.role as UserRole | undefined;
        } catch {
          // Token lookup failed (e.g. stale session) — role falls back to userDoc
        }
        setUserDoc(userDoc);
        setRole(claimRole ?? userDoc?.role ?? null);
      } else {
        reset();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return <>{children}</>;
}
