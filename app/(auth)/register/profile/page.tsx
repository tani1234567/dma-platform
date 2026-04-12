"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { updateUserDocument } from "@/lib/firebase/firestore";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const schema = z.object({
  displayName: z.string().min(2, "Full name must be at least 2 characters"),
  jobTitle: z.string().min(1, "Job title is required"),
  phone: z
    .string()
    .optional()
    .refine((v) => !v || /^\+?[\d\s\-().]{7,20}$/.test(v), "Enter a valid phone number"),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterProfilePage() {
  const router = useRouter();
  const { firebaseUser, loading } = useAuthStore();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Redirect if not logged in once auth has loaded
  useEffect(() => {
    if (!loading && !firebaseUser) {
      router.replace("/register");
    }
  }, [loading, firebaseUser, router]);

  async function onSubmit(data: FormValues) {
    if (!firebaseUser) return;
    setSubmitting(true);
    setError(null);
    try {
      // Update Firebase Auth display name
      await updateProfile(firebaseUser, { displayName: data.displayName });

      // Update Firestore user document — registrationComplete stays false
      // until the company setup wizard is completed at /company-setup
      await updateUserDocument(firebaseUser.uid, {
        displayName: data.displayName,
        jobTitle: data.jobTitle,
        phone: data.phone ?? "",
      });

      router.push("/company-setup");
    } catch {
      setError("Failed to save your profile. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !firebaseUser) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl text-[#333a8b]">Complete your profile</CardTitle>
        <CardDescription>Step 2 of 3 — tell us about yourself</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Full name</Label>
            <Input
              id="displayName"
              type="text"
              autoComplete="name"
              placeholder="Jane Smith"
              {...register("displayName")}
              aria-invalid={!!errors.displayName}
            />
            {errors.displayName && (
              <p className="text-xs text-destructive">{errors.displayName.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="jobTitle">Job title</Label>
            <Input
              id="jobTitle"
              type="text"
              autoComplete="organization-title"
              placeholder="Sustainability Manager"
              {...register("jobTitle")}
              aria-invalid={!!errors.jobTitle}
            />
            {errors.jobTitle && (
              <p className="text-xs text-destructive">{errors.jobTitle.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">
              Phone number{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+44 7700 900000"
              {...register("phone")}
              aria-invalid={!!errors.phone}
            />
            {errors.phone && (
              <p className="text-xs text-destructive">{errors.phone.message}</p>
            )}
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full mt-2" disabled={submitting}>
            {submitting ? "Saving…" : "Go to dashboard"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
