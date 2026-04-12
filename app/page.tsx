import Link from "next/link";
import { BarChart3, Users, BookOpen } from "lucide-react";

// ─── Feature card data ────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: BookOpen,
    title: "GRI-Aligned Topics",
    body: "40 pre-loaded ESG topics across Environmental, Social, and Governance pillars, mapped to GRI Standards.",
  },
  {
    icon: Users,
    title: "Stakeholder Surveys",
    body: "One-click email distribution with secure one-time survey links. Track responses in real time.",
  },
  {
    icon: BarChart3,
    title: "Materiality Matrix",
    body: "Automated weighted scoring with an interactive 2×2 matrix — identify critical, important, and monitor topics instantly.",
  },
] as const;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section
        className="relative flex flex-col items-center justify-center min-h-screen px-6 text-center overflow-hidden"
        style={{ background: "linear-gradient(135deg, #333a8b 0%, #1e1b4b 100%)" }}
      >
        {/* Decorative blobs */}
        <div
          className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #ff6900, transparent)" }}
        />
        <div
          className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #6366f1, transparent)" }}
        />

        {/* Logo */}
        <div className="relative z-10 mb-8">
          <p className="text-5xl font-extrabold text-white tracking-tight leading-none">
            Swifora
          </p>
          <p className="text-sm font-semibold tracking-[0.25em] uppercase mt-1" style={{ color: "#ff6900" }}>
            DMA Platform
          </p>
        </div>

        {/* Headline */}
        <h1 className="relative z-10 text-3xl sm:text-4xl md:text-5xl font-bold text-white max-w-3xl leading-tight mb-5">
          ESG Double Materiality Assessments,{" "}
          <span style={{ color: "#ff6900" }}>Simplified</span>
        </h1>

        {/* Subline */}
        <p className="relative z-10 text-base sm:text-lg text-white/70 max-w-xl mb-10 leading-relaxed">
          GRI-aligned stakeholder surveys, automated scoring, and materiality matrices — all in one platform.
        </p>

        {/* CTAs */}
        <div className="relative z-10 flex flex-col sm:flex-row gap-3">
          <Link
            href="/register"
            className="px-8 py-3 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            style={{ backgroundColor: "#ff6900" }}
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 rounded-lg text-sm font-semibold text-white border border-white/40 hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="bg-white py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-[#333a8b] mb-2">
            Why Swifora
          </p>
          <h2 className="text-center text-2xl sm:text-3xl font-bold text-gray-900 mb-12">
            Everything you need for a GRI-compliant DMA
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-gray-100 bg-gray-50 p-7 flex flex-col gap-4 hover:shadow-md transition-shadow"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "#eff2ff" }}
                >
                  <Icon size={20} color="#333a8b" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1.5">{title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="bg-gray-50 border-t border-gray-200 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <p>© 2025 Sowin Enterprises · Swifora DMA Platform · sowin.world</p>
          <div className="flex gap-5">
            <Link href="/login" className="hover:text-[#333a8b] transition-colors">
              Login
            </Link>
            <Link href="/register" className="hover:text-[#333a8b] transition-colors">
              Register
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
