import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

const BORDER = "#E2E8F0";
const TEXT = "#1E293B";
const HEADER_GRADIENT =
  "linear-gradient(135deg, #2563EB 0%, #0EA5E9 55%, #06B6D4 100%)";
const PAGE_GRADIENT =
  "linear-gradient(135deg, #0B2A5B 0%, #1D4ED8 45%, #0EA5E9 100%)";
const FONT_STACK = "'Inter', 'Poppins', system-ui, sans-serif";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);

  // Supabase puts the recovery token in the URL hash and fires this event
  // once it's parsed the session from that link.
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    // In case the event already fired before this listener attached
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message || "Could not reset password.");
        return;
      }

      setSuccess(true);
      setTimeout(() => navigate("/login"), 2500);
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
          Set New Password
        </h2>
        <p className="text-[13px] text-slate-400 mb-7">
          Choose a new password for your account.
        </p>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        {success ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-3 text-sm text-emerald-700">
            Password updated. Redirecting you to sign in...
          </div>
        ) : !ready ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-3 text-sm text-amber-700">
            Verifying your reset link... If this doesn't load, the link may have
            expired — request a new one from the login page.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                className="text-[11px] tracking-widest uppercase mb-1.5 block"
                style={{ color: "#64748B", fontWeight: 700 }}
              >
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                autoComplete="new-password"
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

            <div>
              <label
                className="text-[11px] tracking-widest uppercase mb-1.5 block"
                style={{ color: "#64748B", fontWeight: 700 }}
              >
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
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
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
