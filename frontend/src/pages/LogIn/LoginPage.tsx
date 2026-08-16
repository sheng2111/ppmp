import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { colors, gradients, font } from "../admin/theme";

// ── Design tokens — now pulled from the shared theme so this page always
// matches Layout.tsx and any other page in the app ─────────────────────────
const PRIMARY = colors.primary;
const PRIMARY_HOVER = colors.primaryHover;
const HEADING = colors.heading;
const BORDER = colors.border;
const TEXT = colors.text;
const HEADER_GRADIENT = gradients.header;
const PAGE_GRADIENT = gradients.page;
const FONT_STACK = font.stack;

export default function LoginPage() {
  const navigate = useNavigate();
  const [emailOrName, setEmailOrName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!emailOrName.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      // NOTE: Supabase email/password auth requires an actual email address.
      // If your users log in with a username instead, resolve it to an email
      // server-side first (e.g. via a lookup table) before calling signIn.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: emailOrName.trim(),
        password,
      });

      if (signInError) {
        setError(signInError.message || "Invalid email or password.");
        return;
      }

      navigate("/dashboard");
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/dashboard` },
      });
      if (oauthError) setError(oauthError.message);
    } catch {
      setError("Google sign-in failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-8 relative overflow-hidden"
      style={{ background: PAGE_GRADIENT, fontFamily: FONT_STACK }}
    >
      {/* Decorative background shapes */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute -bottom-32 -right-16 w-[28rem] h-[28rem] rounded-full bg-white/5" />
      <div className="pointer-events-none absolute top-1/3 right-1/4 w-40 h-40 rounded-full bg-white/5" />

      {/* ── Card ── */}
      <div className="relative z-10 w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col lg:flex-row">
        {/* ── Left panel — branding ── */}
        <div
          className="lg:w-[44%] flex flex-col items-center justify-center text-center px-8 py-12 lg:py-16 relative overflow-hidden"
          style={{ background: HEADER_GRADIENT }}
        >
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-65 h-65 rounded-full">
              <img
                src="/nemsu-logo.png"
                alt="NEMSU Logo"
                className="w-65 h-65 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <h1
              className="text-white text-lg leading-snug tracking-wide -mt-10 "
              style={{ fontWeight: 700 }}
            >
              ELECTRONIC PROCUREMENT
              <br />
              MANAGEMENT SYSTEM
            </h1>
            <p className="text-white/70 text-[11px] mt-8">
              © {new Date().getFullYear()} NEMSU — Surigao del Sur
            </p>
          </div>

          {/* Decorative shapes, kept inside the panel */}
          <div className="pointer-events-none absolute -right-14 -top-14 w-52 h-52 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -left-10 -bottom-14 w-36 h-36 rounded-full bg-white/10" />
        </div>

        {/* ── Right panel — form ── */}
        <div className="flex-1 px-8 py-10 sm:px-12 sm:py-14 flex flex-col justify-center">
          {/* Mobile-only compact logo, shown when the left panel stacks above */}
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ background: HEADER_GRADIENT }}
            >
              <img
                src="/nemsu-logo.png"
                alt="NEMSU Logo"
                className="w-7 h-7 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <div>
              <p
                className="leading-tight text-sm"
                style={{ color: HEADING, fontWeight: 700 }}
              >
                Electronic Procurement
              </p>
              <p className="text-slate-400 text-[11px]">Management System</p>
            </div>
          </div>

          <h2
            className="text-[26px] leading-tight"
            style={{ color: TEXT, fontWeight: 700 }}
          >
            Sign In
          </h2>
          <p className="text-[11px] text-slate-400 tracking-widest uppercase mt-1.5 mb-7">
            Authorized access only
          </p>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

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
                value={emailOrName}
                onChange={(e) => setEmailOrName(e.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
                className="w-full rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all duration-[250ms]"
                style={
                  {
                    background: "#F8FAFC",
                    border: `1px solid ${BORDER}`,
                    color: TEXT,
                    "--tw-ring-color": PRIMARY_HOVER,
                  } as React.CSSProperties
                }
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  className="text-[11px] tracking-widest uppercase"
                  style={{ color: "#64748B", fontWeight: 700 }}
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-xs hover:underline"
                  style={{ color: PRIMARY }}
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full rounded-lg px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 transition-all duration-[250ms]"
                  style={
                    {
                      background: "#F8FAFC",
                      border: `1px solid ${BORDER}`,
                      color: TEXT,
                      "--tw-ring-color": PRIMARY_HOVER,
                    } as React.CSSProperties
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 text-white text-sm rounded-lg disabled:opacity-50 transition-colors duration-[250ms] tracking-widest uppercase"
              style={{ background: HEADER_GRADIENT, fontWeight: 700 }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.filter = "brightness(1.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = "brightness(1)";
              }}
            >
              {loading ? "Signing in..." : "Enter Portal"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ background: BORDER }} />
            <span className="text-xs text-slate-400">OR</span>
            <div className="flex-1 h-px" style={{ background: BORDER }} />
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors duration-[250ms]"
            style={{ border: `1px solid ${BORDER}`, color: TEXT }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path
                fill="#4285F4"
                d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.86 2.7-6.62z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18z"
              />
              <path
                fill="#FBBC05"
                d="M3.95 10.7A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.27-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03z"
              />
              <path
                fill="#EA4335"
                d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58A8.6 8.6 0 0 0 9 0 9 9 0 0 0 .95 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z"
              />
            </svg>
            {googleLoading ? "Connecting..." : "Continue with Google"}
          </button>

          <p className="text-center text-xs text-slate-400 mt-8">
            Having trouble logging in? Contact your office administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
