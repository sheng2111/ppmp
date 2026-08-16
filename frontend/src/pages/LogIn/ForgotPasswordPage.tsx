import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

const PRIMARY = "#0284C7";
const HEADING = "#0369A1";
const BORDER = "#E2E8F0";
const TEXT = "#1E293B";
const HEADER_GRADIENT =
  "linear-gradient(135deg, #2563EB 0%, #0EA5E9 55%, #06B6D4 100%)";
const PAGE_GRADIENT =
  "linear-gradient(135deg, #0B2A5B 0%, #1D4ED8 45%, #0EA5E9 100%)";
const FONT_STACK = "'Inter', 'Poppins', system-ui, sans-serif";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/reset-password`,
        },
      );

      if (resetError) {
        setError(resetError.message || "Could not send reset email.");
        return;
      }

      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-8"
      style={{ background: PAGE_GRADIENT, fontFamily: FONT_STACK }}
    >
      <div className="relative z-10 w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden px-8 py-10 sm:px-10 sm:py-12">
        <h2
          className="text-[24px] leading-tight mb-1.5"
          style={{ color: TEXT, fontWeight: 700 }}
        >
          Reset Password
        </h2>
        <p className="text-[13px] text-slate-400 mb-7">
          Enter your email and we'll send you a reset link.
        </p>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        {sent ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-3 text-sm text-emerald-700">
            Check your inbox — we've sent a password reset link to{" "}
            <strong>{email}</strong>.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                className="text-[11px] tracking-widest uppercase mb-1.5 block"
                style={{ color: "#64748B", fontWeight: 700 }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all duration-[250ms]"
                style={
                  {
                    background: "#F8FAFC",
                    border: `1px solid ${BORDER}`,
                    color: TEXT,
                  } as React.CSSProperties
                }
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 text-white text-sm rounded-lg disabled:opacity-50 transition-colors duration-[250ms] tracking-widest uppercase"
              style={{ background: HEADER_GRADIENT, fontWeight: 700 }}
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={() => navigate("/login")}
          className="text-center w-full text-xs mt-8 hover:underline"
          style={{ color: PRIMARY }}
        >
          Back to Sign In
        </button>
      </div>
    </div>
  );
}
