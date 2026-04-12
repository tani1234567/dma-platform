import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50">
        <Navbar />
      </div>
      <div className="fixed top-14 left-0 bottom-0 w-[220px] z-40 overflow-y-auto bg-white">
        <Sidebar />
      </div>
      <main className="ml-[220px] pt-14 min-h-screen bg-[#f9fafb]">
        {children}
      </main>
    </>
  );
}
