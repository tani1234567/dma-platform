"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import Image from "next/image";
import { signIn } from "@/lib/firebase/auth";
import { getUserDocument } from "@/lib/firebase/firestore";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserRole } from "@/types";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

function firebaseAuthError(code: string): string {
  switch (code) {
    case "auth/user-not-found":
      return "No account found with this email address.";
    case "auth/wrong-password":
      return "Incorrect password. Please try again.";
    case "auth/invalid-credential":
    case "auth/invalid-email":
      return "Invalid email or password.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please wait a few minutes and try again.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact support.";
    default:
      return "Sign in failed. Please check your credentials and try again.";
  }
}

function roleRedirect(role: UserRole | null | undefined, registrationComplete: boolean): string {
  if (role === UserRole.SUPER_ADMIN) return "/admin";
  if (role === UserRole.FIELD_AGENT) return "/agent";
  if (!registrationComplete) return "/company-setup";
  return "/dashboard";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { firebaseUser, userDoc: storeUserDoc, loading: authLoading } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Prevents the auth-state useEffect from racing the form submit redirect
  const submittingRef = useRef(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Redirect already-authenticated users away from the login page (e.g. back-button).
  // Skipped during form submission — onSubmit sets the session cookie first, then redirects.
  useEffect(() => {
    if (authLoading || !firebaseUser || !storeUserDoc || submittingRef.current) return;
    router.replace(roleRedirect(storeUserDoc.role, storeUserDoc.registrationComplete));
  }, [authLoading, firebaseUser, storeUserDoc, router]);

  async function onSubmit(data: FormValues) {
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const credential = await signIn(data.email, data.password);

      // Set session cookie for proxy-based route guards
      try {
        const idToken = await credential.user.getIdToken();
        await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
      } catch { /* non-fatal */ }

      const userDoc = await getUserDocument(credential.user.uid);

      // Resume incomplete registration
      if (userDoc && !userDoc.registrationComplete) {
        router.push(userDoc.displayName ? "/company-setup" : "/register/profile");
        return;
      }

      // Honour redirect param, otherwise route by role
      const redirect = searchParams.get("redirect");
      if (redirect && redirect.startsWith("/")) {
        router.push(redirect);
        return;
      }

      router.push(roleRedirect(userDoc?.role, userDoc?.registrationComplete ?? false));
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      setError(firebaseAuthError(code));
      submittingRef.current = false; // re-enable auth-state redirect if login failed
    } finally {
      setLoading(false);
    }
  }

  const urlError = searchParams.get("error");

  // Show spinner while checking existing auth state
  if (authLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <Image
        src="/DMA_logo.png"
        alt="DMA Platform Logo"
        width={120}
        height={120}
        priority
      />
      <Card className="shadow-sm w-full">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl text-[#333a8b]">Welcome back</CardTitle>
          <CardDescription>Sign in to your Swifora account</CardDescription>
        </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              {...register("email")}
              aria-invalid={!!errors.email}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-xs text-[#333a8b] hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              {...register("password")}
              aria-invalid={!!errors.password}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {urlError === "unauthorized" && !error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2">
              <p className="text-sm text-red-700">
                You don&apos;t have permission to access that page.
              </p>
            </div>
          )}

          <Button type="submit" className="w-full mt-2" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="mt-5 text-center">
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-[#333a8b] font-medium hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
