import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function OnboardingPage() {
  const { user, refreshDbUser } = useAuth();
  const navigate = useNavigate();
  const [officeName, setOfficeName] = useState("");
  const [officeCode, setOfficeCode] = useState("");
  const [headName, setHeadName] = useState("");
  const [designation, setDesignation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!officeName || !officeCode) {
      setError("Office name and code are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post("/auth/onboard", {
        supabase_uid: user?.id,
        office_name: officeName,
        office_code: officeCode,
        head_name: headName || null,
        designation: designation || null,
      });
      await refreshDbUser();
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to complete setup.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold text-blue-900">
            Welcome to e-PMS!
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Let's set up your office so you can start creating PPMPs.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Office / Department Name <span className="text-red-400">*</span>
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={officeName}
              onChange={(e) => setOfficeName(e.target.value)}
              placeholder="e.g. College of Information and Computing Technology"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Office Code <span className="text-red-400">*</span>
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={officeCode}
              onChange={(e) => setOfficeCode(e.target.value.toUpperCase())}
              placeholder="e.g. CICT"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Office Head Name (optional)
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={headName}
              onChange={(e) => setHeadName(e.target.value)}
              placeholder="e.g. Juan Dela Cruz"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Designation (optional)
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g. Dean, Campus Director"
            />
          </div>
        </div>

        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full mt-6 px-4 py-2.5 bg-blue-700 text-white text-sm rounded-lg hover:bg-blue-800 disabled:opacity-50 transition"
        >
          {saving ? "Setting up..." : "Continue to Dashboard"}
        </button>
      </div>
    </div>
  );
}
