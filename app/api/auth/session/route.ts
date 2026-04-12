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

    // Fetch role from Firestore — new users won't have JWT custom claims yet
    let role: string | null = null;
    try {
      const snap = await adminDb.collection("users").doc(decoded.uid).get();
      if (snap.exists) role = snap.data()?.role ?? null;
    } catch { /* non-fatal */ }

    const cookieOpts = {
      maxAge: MAX_AGE,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax" as const,
    };

    const res = NextResponse.json({ success: true });
    // __session: presence flag (uid stored — not security-sensitive, just for proxy checks)
    res.cookies.set("__session", decoded.uid, cookieOpts);
    // __claims: base64 role for proxy role-based routing
    res.cookies.set(
      "__claims",
      Buffer.from(JSON.stringify({ role, uid: decoded.uid })).toString("base64"),
      cookieOpts
    );
    return res;
  } catch (err) {
    console.error("[session POST]", err);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set("__session", "", { maxAge: 0, path: "/" });
  res.cookies.set("__claims", "", { maxAge: 0, path: "/" });
  return res;
}
