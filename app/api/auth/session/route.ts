import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

const MAX_AGE = 60 * 60 * 24 * 5; // 5 days in seconds

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();
    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);

    // Resolve role: Firestore is authoritative; Firebase custom claims are fallback.
    // This covers super-admins whose custom claims were set directly in the console.
    let role: string | null = (decoded.role as string | undefined) ?? null;
    try {
      const snap = await adminDb.collection("users").doc(decoded.uid).get();
      if (snap.exists) {
        const firestoreRole = snap.data()?.role ?? null;
        if (firestoreRole) role = firestoreRole; // Firestore wins if present
      }
    } catch { /* non-fatal — keep custom-claims role */ }

    const cookieOpts = {
      maxAge: MAX_AGE,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax" as const,
    };

    const res = NextResponse.json({ success: true });
    // __session: only cookie Firebase Hosting forwards to Cloud Run — encode uid + role here
    res.cookies.set(
      "__session",
      Buffer.from(JSON.stringify({ uid: decoded.uid, role })).toString("base64"),
      cookieOpts
    );
    // Clear any stale __claims cookie from previous deploys
    res.cookies.set("__claims", "", { maxAge: 0, path: "/" });
    return res;
  } catch (err) {
    console.error("[session POST]", err);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set("__session", "", { maxAge: 0, path: "/" });
  res.cookies.set("__claims", "", { maxAge: 0, path: "/" }); // clear legacy cookie
  return res;
}
