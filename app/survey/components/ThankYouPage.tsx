"use client";

import { CheckCircle2 } from "lucide-react";

interface ThankYouPageProps {
  companyName: string;
  fyYear: string;
}

export function ThankYouPage({ companyName, fyYear }: ThankYouPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow border border-gray-100 max-w-md w-full p-10 text-center">
        <div className="flex justify-center mb-6">
          <CheckCircle2 size={64} className="text-[#16a34a]" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          Thank you for your response!
        </h1>
        <p className="text-gray-600 text-sm leading-relaxed mb-6">
          Your feedback has been submitted for{" "}
          <span className="font-semibold">{companyName}</span>&apos;s FY {fyYear} ESG
          Materiality Assessment.
        </p>
        <p className="text-sm text-gray-400">You may now close this tab.</p>
      </div>

      <p className="mt-8 text-xs text-gray-400">Powered by Swifora DMA Platform</p>
    </div>
  );
}
