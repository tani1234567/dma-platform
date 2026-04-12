import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    const { uid, email, displayName, role } = await req.json();

    if (!uid || !email) {
      return NextResponse.json({ error: "Missing uid or email" }, { status: 400 });
    }

    // Verify UID is a real Firebase Auth user
    try {
      await adminAuth.getUser(uid);
    } catch {
      return NextResponse.json({ error: "Invalid user" }, { status: 401 });
    }

    await adminDb.collection("users").doc(uid).set({
      uid,
      email,
      displayName: displayName ?? "",
      role: role ?? "company_admin",
      registrationComplete: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[init-user]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
