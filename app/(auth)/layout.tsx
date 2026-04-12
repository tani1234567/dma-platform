export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left — branding panel (hidden on mobile) */}
      <div className="hidden lg:flex flex-col justify-between bg-[#333a8b] px-12 py-10 text-white">
        <div>
          <span className="text-2xl font-bold tracking-tight">
            <span className="text-[#ff6900]">Swifora</span>
          </span>
        </div>

        <div className="space-y-6 max-w-sm">
          <h2 className="text-3xl font-bold leading-snug">
            Double Materiality Assessment, made simple.
          </h2>
          <p className="text-white/70 text-sm leading-relaxed">
            Identify, score, and report on the sustainability topics that are material
            to your business — aligned with ESRS and GRI standards.
          </p>

          <div className="grid grid-cols-3 gap-4 pt-4">
            {[
              { value: "ESRS", label: "Aligned" },
              { value: "GRI", label: "Supported" },
              { value: "EU", label: "CSRD Ready" },
            ].map((stat) => (
              <div key={stat.value} className="bg-white/10 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-[#ff6900]">{stat.value}</p>
                <p className="text-xs text-white/70 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/40">
          © {new Date().getFullYear()} Swifora. All rights reserved.
        </p>
      </div>

      {/* Right — form area */}
      <div className="flex items-center justify-center px-6 py-12 bg-gray-50">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <span className="text-2xl font-bold text-[#333a8b]">
              Swi<span className="text-[#ff6900]">fora</span>
            </span>
            <p className="text-xs text-muted-foreground mt-1">DMA Platform</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
