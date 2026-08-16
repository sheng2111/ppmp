import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import api from "../../services/api";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/feedback/ToastProvider";
import { LoadingButton } from "../../components/feedback/LoadingButton";

// ── Design tokens — kept identical to LoginPage.tsx / Layout.tsx so this page
// matches the rest of the enterprise EPMS theme ─────────────────────────────
const PRIMARY = "#0284C7";
const HEADING = "#0369A1";
const BORDER = "#E2E8F0";
const TEXT = "#1E293B";
const HEADER_GRADIENT =
  "linear-gradient(135deg, #2563EB 0%, #0EA5E9 55%, #06B6D4 100%)";
const PAGE_GRADIENT =
  "linear-gradient(135deg, #0B2A5B 0%, #1D4ED8 45%, #0EA5E9 100%)";
const FONT_STACK = "'Inter', 'Poppins', system-ui, sans-serif";

const capitalizeName = (value: string) =>
  value
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");

export default function PendingApprovalPage() {
  const { user: supabaseUser, refreshDbUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isValid =
    fullName.trim().length > 1 &&
    password.length >= 8 &&
    password === confirmPassword;

  const handleSubmit = async () => {
    if (!supabaseUser || !isValid) return;
    setSubmitting(true);
    setError("");

    try {
      // 1. Set the password on the Supabase Auth account (this is what lets
      // them log in with email/password later instead of only Google).
      const { error: pwError } = await supabase.auth.updateUser({ password });
      if (pwError && pwError.message !== "Unable to validate email address: invalid format") {
        // If password update fails (e.g. already set), continue anyway —
        // the important part is creating the Mongo user record below.
        console.warn("Password update skipped:", pwError.message);
      }

      // 2. Create the Mongo user record — account is created and activated
      // immediately. Office assignment happens later, per-PPMP.
      await api.post("/auth/onboard", {
        supabase_uid: supabaseUser.id,
        email: supabaseUser.email,
        full_name: capitalizeName(fullName.trim()),
      });

      await refreshDbUser();
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail ||
          "Could not finish setting up your account. Please try again.",
      );
    } finally {
      setSubmitting(false);
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
              className="text-white text-lg leading-snug tracking-wide -mt-10"
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
            Finish Setting Up
          </h2>
          <p className="text-[11px] text-slate-400 tracking-widest uppercase mt-1.5 mb-7"></p>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label
                className="text-[11px] tracking-widest uppercase mb-1.5 block"
                style={{ color: "#64748B", fontWeight: 700 }}
              >
                Full name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onBlur={() => setFullName((v) => capitalizeName(v))}
                placeholder="e.g. Juan M. Dela Cruz"
                className="w-full rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all duration-[250ms]"
                style={
                  {
                    background: "#F8FAFC",
                    border: `1px solid ${BORDER}`,
                    color: TEXT,
                    "--tw-ring-color": PRIMARY,
                  } as React.CSSProperties
                }
              />
              <p className="text-xs text-slate-400 mt-1">
                Used as your printed name on PPMPs, APPs, and PRs.
              </p>
            </div>

            <div>
              <label
                className="text-[11px] tracking-widest uppercase mb-1.5 block"
                style={{ color: "#64748B", fontWeight: 700 }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  className="w-full rounded-lg pl-3.5 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all duration-[250ms]"
                  style={
                    {
                      background: "#F8FAFC",
                      border: `1px solid ${BORDER}`,
                      color: TEXT,
                      "--tw-ring-color": PRIMARY,
                    } as React.CSSProperties
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors duration-150"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {password.length > 0 && password.length < 8 && (
                <p className="text-xs text-red-500 mt-1">
                  Password must be at least 8 characters.
                </p>
              )}
            </div>

            <div>
              <label
                className="text-[11px] tracking-widest uppercase mb-1.5 block"
                style={{ color: "#64748B", fontWeight: 700 }}
              >
                Confirm password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  className="w-full rounded-lg pl-3.5 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all duration-[250ms]"
                  style={
                    {
                      background: "#F8FAFC",
                      border: `1px solid ${BORDER}`,
                      color: TEXT,
                      "--tw-ring-color": PRIMARY,
                    } as React.CSSProperties
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors duration-150"
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="text-xs text-red-500 mt-1">
                  Passwords don't match.
                </p>
              )}
            </div>

            <LoadingButton
              type="button"
              onClick={handleSubmit}
              disabled={!isValid || submitting}
              busy={submitting}
              busyLabel="Setting up..."
              className="w-full py-3 text-white text-sm rounded-lg disabled:opacity-50 transition-colors duration-[250ms] tracking-widest uppercase"
              style={{ background: HEADER_GRADIENT, fontWeight: 700 }}
              onMouseEnter={(e) => {
                if (!submitting && isValid)
                  e.currentTarget.style.filter = "brightness(1.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = "brightness(1)";
              }}
            >
              Finish setup
            </LoadingButton>
          </div>

          <p className="text-center text-xs text-slate-400 mt-8">
            Having trouble? Contact your office administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
