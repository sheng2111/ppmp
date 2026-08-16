import { useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { supabase } from "../lib/supabase";
import { Camera, Eye, EyeOff, Lock } from "lucide-react";
import { useToast } from "../components/feedback/ToastProvider";
import { LoadingButton } from "../components/feedback/LoadingButton";
import PageHeader from "../components/layout/PageHeader";

const MIN_LENGTH = 8;

// ── NOTES ───────────────────────────────────────────────────────────────────
// 1. useAuth() exposes: dbUser { id, supabase_uid, full_name, email, role,
//    offices }, and `user` — the raw Supabase auth user.
// 2. Custom-API path: PATCH /users/:id accepts multipart/form-data with
//    `full_name` and (optionally) an `avatar` file. It expects the caller's
//    Supabase uid via the `requester_uid` query param so the backend can
//    verify the account owner is the one editing. Returns the updated user.
//    See backend app/routers/users.py.
// 3. This endpoint only updates the User profile (full_name). Historical
//    PPMP/APP/PR records keep the name they were created with — new records
//    created after the change pick up the new name automatically.
// 4. `refreshDbUser()` (from AuthContext) is called after a successful save
//    so the whole app immediately sees the updated name.
// -----------------------------------------------------------------------------

const initials = (name?: string) =>
  name
    ? name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join("")
    : "?";

export default function ProfilePage() {
  const { dbUser, refreshDbUser } = useAuth();
  const toast = useToast();

  const [fullName, setFullName] = useState(dbUser?.full_name || "");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(
    (dbUser as any)?.avatar_url,
  );
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);

  // ── Security (password) state ────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const dirty =
    fullName.trim() !== (dbUser?.full_name || "").trim() || !!avatarFile;

  const handlePickAvatar = () => fileInputRef.current?.click();

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5MB.");
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      toast.error("Name can't be empty.");
      return;
    }
    setSaving(true);
    try {
      // ── Custom-API path ────────────────────────────────────────────────
      const formData = new FormData();
      formData.append("full_name", fullName.trim());
      if (avatarFile) formData.append("avatar", avatarFile);

      const res = await api.patch(`/users/${dbUser?.id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        params: { requester_uid: dbUser?.supabase_uid },
      });
      setAvatarUrl(res.data?.avatar_url || avatarUrl);

      // Refresh the cached user so the new full name is reflected app-wide
      // immediately (and picked up by any new PPMP/APP/PR created afterwards).
      await refreshDbUser();

      setAvatarFile(null);
      setAvatarPreview(null);
      toast.success("Profile updated.");
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail || err.message || "Failed to save changes.",
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Security: password change ─────────────────────────────────────────────
  const validatePassword = (): string => {
    if (!currentPassword) {
      return "Current password is required.";
    }
    if (newPassword.length < MIN_LENGTH) {
      return `New password must be at least ${MIN_LENGTH} characters.`;
    }
    if (newPassword !== confirmPassword) {
      return "New password and confirmation don't match.";
    }
    if (newPassword === currentPassword) {
      return "New password cannot be the same as your current password.";
    }
    return "";
  };

  const handlePasswordSubmit = async () => {
    const validationError = validatePassword();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (!dbUser?.email) {
      toast.error(
        "Unable to identify your account. Please refresh the page.",
      );
      return;
    }

    setSavingPassword(true);

    try {
      // Re-authenticate to verify the current password before changing it.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: dbUser.email,
        password: currentPassword,
      });

      if (signInError) {
        toast.error("Current password is incorrect.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        toast.error(updateError.message || "Failed to update password.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated. Use it the next time you sign in.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update password.");
    } finally {
      setSavingPassword(false);
    }
  };

  const passwordsDontMatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;

  const displayedAvatar = avatarPreview || avatarUrl;

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title="Profile & Security"
        subtitle="Update your name and photo, or change your password. Other details are managed by your administrator."
      />

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {/* Avatar */}
        <div className="flex items-center gap-5 mb-6">
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-blue-100 flex items-center justify-center text-blue-800 text-xl font-semibold border border-gray-200">
              {displayedAvatar ? (
                <img
                  src={displayedAvatar}
                  alt="Profile avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                initials(dbUser?.full_name)
              )}
            </div>
            <button
              type="button"
              onClick={handlePickAvatar}
              aria-label="Change photo"
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-blue-700 hover:bg-blue-800 text-white flex items-center justify-center shadow-md transition"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">
              {dbUser?.full_name}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              JPG or PNG, up to 5MB
            </p>
          </div>
        </div>

        {/* Editable name */}
        <div className="mb-4">
          <label className="text-xs text-gray-500 mb-1 block">Full name</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Juan Dela Cruz"
          />
        </div>

        {/* Read-only fields */}
        <div className="grid grid-cols-2 gap-4 mb-2">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Email</label>
            <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              {dbUser?.email}
            </p>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Role</label>
            <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 capitalize">
              {dbUser?.role}
            </p>
          </div>
        </div>

        {dbUser?.offices && dbUser.offices.length > 0 && (
          <div className="mb-2">
            <label className="text-xs text-gray-500 mb-2 block">
              Assigned office{dbUser.offices.length > 1 ? "s" : ""}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {dbUser.offices.map((o: any) => (
                <span
                  key={o.id}
                  className="inline-flex items-center text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full"
                >
                  {o.name} ({o.code})
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end mt-6">
          <LoadingButton
            onClick={handleSave}
            disabled={!dirty}
            busy={saving}
            busyLabel="Saving..."
          >
            Save changes
          </LoadingButton>
        </div>
      </div>

      {/* ── Security ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
        <h2 className="text-sm font-semibold text-blue-900 mb-1">Security</h2>
        <p className="text-xs text-gray-400 mb-4">
          Enter your current password to set a new one.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Current password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showCurrentPassword ? "text" : "password"}
                className="w-full border border-gray-300 rounded-lg pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter current password"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowCurrentPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrentPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              New password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showNewPassword ? "text" : "password"}
                className="w-full border border-gray-300 rounded-lg pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                placeholder={`At least ${MIN_LENGTH} characters`}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowNewPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNewPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {newPassword.length > 0 && newPassword.length < MIN_LENGTH && (
              <p className="text-xs text-red-500 mt-1">
                Must be at least {MIN_LENGTH} characters.
              </p>
            )}
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Confirm new password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                className="w-full border border-gray-300 rounded-lg pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Re-enter new password"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {passwordsDontMatch && (
              <p className="text-xs text-red-500 mt-1">
                Passwords don't match.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <LoadingButton
            onClick={handlePasswordSubmit}
            disabled={!currentPassword || !newPassword || !confirmPassword}
            busy={savingPassword}
            busyLabel="Updating..."
          >
            Update password
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}
