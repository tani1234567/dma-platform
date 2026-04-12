import { Navbar } from "@/components/layout/Navbar";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex-1">{children}</div>
    </div>
  );
}
