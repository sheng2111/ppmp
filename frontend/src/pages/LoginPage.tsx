import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { signInWithGoogle } = useAuth();

  return (
    <div className="min-h-screen bg-[#080616] flex items-center justify-center relative overflow-hidden px-4">
      {/* ambient glow */}
      <div
        className="pointer-events-none absolute w-[700px] h-[700px] rounded-full blur-[80px]"
        style={{
          background:
            "radial-gradient(circle, rgba(47,47,228,0.35) 0%, rgba(22,46,147,0.12) 45%, transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-md bg-[#1A1953]/55 backdrop-blur-xl border border-[#2F2FE4]/25 rounded-3xl px-10 py-12 text-center shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
        {/* icon chip */}
        <div className="w-14 h-14 mx-auto mb-6 rounded-full bg-[#2F2FE4]/15 border border-[#2F2FE4]/40 flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-6 h-6"
          >
            <path d="M3 21h18" />
            <path d="M5 21V7l7-4 7 4v14" />
            <path d="M9 9h1" />
            <path d="M14 9h1" />
            <path d="M9 13h1" />
            <path d="M14 13h1" />
            <path d="M10 21v-4a2 2 0 0 1 4 0v4" />
          </svg>
        </div>

        <h1 className="text-[26px] font-semibold tracking-tight text-white mb-2">
          e-PMS
        </h1>
        <p className="text-[13px] text-[#8890B5] leading-relaxed mb-8">
          NEMSU Electronic Procurement
          <br />
          Management System
        </p>

        <hr className="border-t border-[#2F2FE4]/20 mb-7" />

        <p className="text-[13px] text-[#B4BBDA] mb-5">Sign in to continue</p>

        <button
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-[#080616]/60 border border-[#2F2FE4]/35 rounded-full text-white text-sm font-normal transition-colors hover:bg-[#162E93]/40 hover:border-[#2F2FE4]/60 active:scale-[0.97]"
        >
          <img
            src="https://www.svgrepo.com/show/475656/google-color.svg"
            className="w-[18px] h-[18px]"
            alt="Google"
          />
          Sign in with Google
        </button>

        <p className="mt-7 text-[11px] text-[#5A6089] leading-relaxed">
          Access is limited to authorized NEMSU personnel.
        </p>
      </div>
    </div>
  );
}
