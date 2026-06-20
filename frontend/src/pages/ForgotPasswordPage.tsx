import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const ForgotPasswordPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleGoogleReset = async () => {
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: "http://localhost:3000/reset-password",
        },
      });
      if (error) setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "linear-gradient(135deg, #1e3a6e 0%, #1a56a0 50%, #2471c8 100%)",
      }}
    >
      {/* Background circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full border border-white opacity-5" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full border border-white opacity-5" />
      </div>

      {/* Card */}
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div
          className="px-8 pt-8 pb-6 text-center"
          style={{
            background: "linear-gradient(180deg, #1a3a6b 0%, #1a56a0 100%)",
          }}
        >
          <img
            src="/nemsu-logo.png"
            alt="NEMSU Logo"
            className="w-20 h-20 object-contain mx-auto mb-3"
          />
          <h1 className="text-white font-bold text-sm uppercase tracking-wider">
            Electronic Procurement
          </h1>
          <h1 className="text-white font-bold text-sm uppercase tracking-wider">
            Management System
          </h1>
        </div>

        {/* Body */}
        <div className="px-8 py-8 text-center">
          {/* Lock icon */}
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-7 h-7 text-blue-800"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
          </div>

          <h2 className="text-gray-800 text-xl font-bold mb-2">
            Forgot Password?
          </h2>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            Verify your identity using your Google account. You'll be able to
            set a new password after verification.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2 rounded-xl mb-4">
              ⚠️ {error}
            </div>
          )}

          {/* Google Verify Button */}
          <button
            type="button"
            onClick={handleGoogleReset}
            disabled={loading}
            className="w-full border border-gray-200 bg-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-gray-50 transition text-gray-700 shadow-sm mb-4 disabled:opacity-60"
          >
            <img
              src="https://www.google.com/favicon.ico"
              className="w-4 h-4"
              alt="Google"
            />
            {loading ? "Redirecting..." : "Verify with Google"}
          </button>

          {/* Back to login */}
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="text-xs text-blue-700 hover:underline font-medium"
          >
            ← Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
