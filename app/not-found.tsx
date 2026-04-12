import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{ backgroundColor: "#eff2ff" }}
      >
        <span className="text-2xl font-bold" style={{ color: "#333a8b" }}>
          ?
        </span>
      </div>

      <h1 className="text-5xl font-extrabold mb-2" style={{ color: "#333a8b" }}>
        404
      </h1>
      <p className="text-lg font-semibold text-gray-700 mb-2">Page Not Found</p>
      <p className="text-sm text-gray-500 mb-8 max-w-xs">
        The page you are looking for does not exist or has been moved.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/dashboard"
          className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#333a8b" }}
        >
          Back to Dashboard
        </Link>
        <Link
          href="/login"
          className="px-6 py-2.5 rounded-lg text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
        >
          Sign In
        </Link>
      </div>
    </div>
  );
}
