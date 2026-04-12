"use client";

import { Clock } from "lucide-react";

export function ExpiredTokenPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow border border-gray-100 max-w-md w-full p-10 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-6">
          <Clock size={32} className="text-amber-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-3">Survey Link Expired</h1>
        <p className="text-gray-600 text-sm leading-relaxed">
          This survey link has expired. Please contact the company&apos;s ESG team to request a
          new link.
        </p>
      </div>
    </div>
  );
}
