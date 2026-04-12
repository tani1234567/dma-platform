"use client";

import { CheckCircle2 } from "lucide-react";

export function AlreadySubmittedPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow border border-gray-100 max-w-md w-full p-10 text-center">
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={32} className="text-green-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-3">Already Submitted</h1>
        <p className="text-gray-600 text-sm leading-relaxed">
          You have already submitted your response for this survey. Thank you!
        </p>
      </div>
    </div>
  );
}
