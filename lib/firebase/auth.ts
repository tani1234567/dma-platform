"use client";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile,
} from "firebase/auth";
import { auth } from "./config";
import { getUserDocument } from "./firestore";
import { UserRole } from "@/types";

export async function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUp(
  email: string,
  password: string,
  displayName = "",
  role: UserRole = UserRole.COMPANY_ADMIN,
  companyId?: string
) {
  // accounts:lookup is called internally by the Firebase SDK after createUserWithEmailAndPassword.
  // In Firebase v12 it can fail with USER_NOT_FOUND even though the user was created successfully.
  // We catch that and fall back to auth.currentUser.
  let uid: string;
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) await updateProfile(credential.user, { displayName });
    uid = credential.user.uid;
  } catch (err: unknown) {
    const currentUser = auth.currentUser;
    if (!currentUser) throw err; // Real error — rethrow
    // User was created but SDK reload failed — continue with the current user
    uid = currentUser.uid;
  }

  // Write the user document via server API route (Admin SDK) to bypass client-side auth issues
  const res = await fetch("/api/auth/init-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid, email, displayName, role, companyId }),
  });

  if (!res.ok) {
    throw new Error("Failed to initialise user profile");
  }
}

export async function logOut() {
  return signOut(auth);
}

export async function resetPassword(email: string) {
  return sendPasswordResetEmail(auth, email);
}

export function onAuthChange(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function getIdTokenResult(user: FirebaseUser) {
  return user.getIdTokenResult();
}

export async function refreshToken(user: FirebaseUser) {
  return user.getIdToken(true);
}
