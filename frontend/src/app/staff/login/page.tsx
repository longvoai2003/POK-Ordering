"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { staffLogin, setStaffToken } from "@/lib/api";
import { ApiError } from "@/lib/api-client";

export default function StaffLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { token } = await staffLogin(password);
      setStaffToken(token);
      router.push("/staff/orders");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.getMessage() : "Login failed",
      );
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={handleLogin}
        className="organic-card w-full max-w-sm rounded-3xl border border-[#cfc39f] p-7 shadow-[0_22px_55px_rgba(61,89,50,0.12)]"
      >
        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#5e4318]">
          Staff
        </p>
        <h1 className="mt-2 text-2xl font-extrabold text-[#1f321b]">
          Sign in
        </h1>
        <p className="mt-1 text-sm font-medium text-[#68775a]">
          Enter the staff password to manage orders.
        </p>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Staff password"
          disabled={loading}
          className="mt-5 w-full rounded-2xl border border-[#cfc39f] bg-[#fffdf6] px-4 py-3 text-sm font-semibold text-[#1f321b] placeholder-[#b0a87e] outline-none focus:ring-2 focus:ring-[#2f6f2d]/30"
        />

        {error && (
          <p className="mt-3 text-xs font-semibold text-[#a84828]">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !password.trim()}
          className="mt-5 w-full rounded-2xl bg-[#2f6f2d] px-5 py-3.5 text-sm font-extrabold text-white shadow-[0_14px_30px_rgba(47,111,45,0.28)] transition hover:bg-[#245c24] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#b6ad92] disabled:text-[#f7f0dc]"
        >
          {loading ? "Signing in..." : "Sign in →"}
        </button>
      </form>
    </main>
  );
}
