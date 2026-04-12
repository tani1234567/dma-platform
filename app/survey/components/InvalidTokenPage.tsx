"use client";

import { AlertCircle } from "lucide-react";

export function InvalidTokenPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow border border-gray-100 max-w-md w-full p-10 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
          <AlertCircle size={32} className="text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-3">Invalid Survey Link</h1>
        <p className="text-gray-600 text-sm leading-relaxed">
          This survey link is not valid. Please check your email for the correct link.
        </p>
      </div>
    </div>
  );
}
