import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

const EyeIcon = ({ open }: { open: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="w-4 h-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    {open ? (
      <>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        />
      </>
    ) : (
      <>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 012.163-3.592M6.53 6.533A9.97 9.97 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.97 9.97 0 01-4.423 5.307M3 3l18 18"
        />
      </>
    )}
  </svg>
);

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleError = (err: any) => {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") {
      setError(detail);
    } else if (Array.isArray(detail)) {
      setError(detail.map((e: any) => e.msg).join(", "));
    } else {
      setError("Something went wrong.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/dashboard");
    } catch (err: any) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      // options: { redirectTo: "http://localhost:3000/auth/callback" },
      options: { redirectTo: "http://192.168.2.2:3000/auth/callback" },
    });
    if (error) setError(error.message);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "linear-gradient(135deg, #1e3a6e 0%, #1a56a0 50%, #2471c8 100%)",
      }}
    >
      {/* Background decorative circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full border border-white opacity-5" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full border border-white opacity-5" />
        <div className="absolute top-1/3 right-1/3 w-64 h-64 rounded-full border border-white opacity-5" />
      </div>

      {/* Floating Card */}
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[500px]">
        {/* LEFT PANEL */}
        <div
          className="w-full md:w-5/12 flex flex-col items-center justify-center px-8 py-10 text-center"
          style={{
            background: "linear-gradient(180deg, #1a3a6b 0%, #1a56a0 100%)",
          }}
        >
          {/* Logo */}
          <div className="mb-6">
            <img
              src="/nemsu-logo.png"
              alt="NEMSU Logo"
              className="w-44 h-44 object-contain drop-shadow-xl mx-auto"
            />
          </div>

          {/* System name */}
          <h1 className="text-white font-bold text-base uppercase tracking-wider leading-snug">
            Electronic Procurement
          </h1>
          <h1 className="text-white font-bold text-base uppercase tracking-wider leading-snug">
            Management System
          </h1>

          {/* Bottom */}
          <p className="text-blue-400 text-xs mt-8">
            © {new Date().getFullYear()} NEMSU — Tagbina Campus
          </p>
        </div>

        {/* RIGHT PANEL */}
        <div className="w-full md:w-7/12 flex flex-col justify-center px-8 md:px-12 py-10 bg-white">
          <div className="max-w-sm w-full mx-auto">
            <h2 className="text-gray-800 text-2xl font-bold">Sign In</h2>
            <p className="text-gray-400 text-xs uppercase tracking-widest mt-1 mb-7">
              Authorized Access Only
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-transparent transition"
                  placeholder="Enter your username"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-transparent transition pr-10"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-700 transition"
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </div>
              {/* Add this right after the password div, before error */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-xs text-blue-700 hover:underline font-medium"
                >
                  Forgot Password?
                </button>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2 rounded-xl">
                  ⚠️ {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-all disabled:opacity-60 shadow-md hover:shadow-lg mt-1"
                style={{
                  background: "linear-gradient(90deg, #1e3a6e, #1a56a0)",
                }}
              >
                {loading ? "Signing in..." : "Log In"}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-gray-400 uppercase tracking-widest">
                  or
                </span>
              </div>
            </div>

            {/* Google Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full border border-gray-200 bg-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-gray-50 transition text-gray-600 shadow-sm"
            >
              <img
                src="https://www.google.com/favicon.ico"
                className="w-4 h-4"
                alt="Google"
              />
              Continue with Google
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
