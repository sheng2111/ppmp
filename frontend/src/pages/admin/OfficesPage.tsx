import { useState, useEffect } from "react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import type { Office } from "../../types";

interface AdminUser {
  id: number;
  full_name: string;
  email: string;
  role: string;
  designation: string | null;
  is_approved: boolean;
  offices: { id: number; name: string; code: string }[];
}

export default function OfficesPage() {
  const { user: supabaseUser } = useAuth();
  const [activeTab, setActiveTab] = useState<"offices" | "users">("offices");

  // ── Offices state ──────────────────────────────────────────────────────────
  const [offices, setOffices] = useState<Office[]>([]);
  const [officesLoading, setOfficesLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Office | null>(null);
  const [officeForm, setOfficeForm] = useState({
    name: "",
    code: "",
    head_name: "",
    designation: "",
  });
  const [officeSaving, setOfficeSaving] = useState(false);

  // ── Users state ────────────────────────────────────────────────────────────
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");
  const [userSubTab, setUserSubTab] = useState<"pending" | "active">("pending");
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const [userEditForm, setUserEditForm] = useState({
    designation: "",
    role: "user",
    office_ids: [] as number[],
  });
  const [userSaving, setUserSaving] = useState(false);

  const fetchOffices = async () => {
    try {
      const res = await api.get("/offices/");
      setOffices(res.data);
    } finally {
      setOfficesLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!supabaseUser) return;
    setUsersLoading(true);
    setUsersError("");
    try {
      const res = await api.get("/auth/users", {
        params: { requester_uid: supabaseUser.id },
      });
      setUsers(res.data);
    } catch (err: any) {
      setUsersError(err.response?.data?.detail || "Could not load users.");
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    fetchOffices();
  }, []);
  useEffect(() => {
    if (activeTab === "users") fetchUsers();
  }, [activeTab, supabaseUser]);

  // ── Office CRUD ────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditTarget(null);
    setOfficeForm({ name: "", code: "", head_name: "", designation: "" });
    setShowForm(true);
  };

  const openEdit = (o: Office) => {
    setEditTarget(o);
    setOfficeForm({
      name: o.name,
      code: o.code,
      head_name: o.head_name || "",
      designation: o.designation || "",
    });
    setShowForm(true);
  };

  const handleOfficeSave = async () => {
    setOfficeSaving(true);
    try {
      if (editTarget) {
        await api.put(`/offices/${editTarget.id}`, officeForm);
      } else {
        await api.post("/offices/", officeForm);
      }
      setShowForm(false);
      fetchOffices();
    } finally {
      setOfficeSaving(false);
    }
  };

  const handleOfficeDelete = async (id: number) => {
    if (!confirm("Delete this office?")) return;
    await api.delete(`/offices/${id}`);
    fetchOffices();
  };

  // ── User editing ───────────────────────────────────────────────────────────
  const openUserEdit = (u: AdminUser) => {
    setEditUserId(u.id);
    setUserEditForm({
      designation: u.designation || "",
      role: u.role,
      office_ids: u.offices.map((o) => o.id),
    });
  };

  const toggleOffice = (officeId: number) => {
    setUserEditForm((prev) => ({
      ...prev,
      office_ids: prev.office_ids.includes(officeId)
        ? prev.office_ids.filter((id) => id !== officeId)
        : [...prev.office_ids, officeId],
    }));
  };

  const saveUserEdit = async (userId: number) => {
    if (!supabaseUser) return;
    setUserSaving(true);
    try {
      await api.put(
        `/auth/users/${userId}`,
        {
          designation: userEditForm.designation || null,
          role: userEditForm.role,
          office_ids: userEditForm.office_ids,
        },
        { params: { requester_uid: supabaseUser.id } },
      );
      setEditUserId(null);
      fetchUsers();
    } catch (err: any) {
      setUsersError(err.response?.data?.detail || "Could not update user.");
    } finally {
      setUserSaving(false);
    }
  };

  const approveUser = async (userId: number) => {
    if (!supabaseUser) return;
    try {
      await api.put(
        `/auth/users/${userId}`,
        { is_approved: true },
        { params: { requester_uid: supabaseUser.id } },
      );
      fetchUsers();
    } catch (err: any) {
      setUsersError(err.response?.data?.detail || "Could not approve user.");
    }
  };

  const pendingUsers = users.filter((u) => !u.is_approved);
  const activeUsers = users.filter((u) => u.is_approved);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-blue-900">
            {activeTab === "offices" ? "Offices" : "Users"}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {activeTab === "offices"
              ? "Manage university offices and departments"
              : "Approve and manage user accounts"}
          </p>
        </div>
        {activeTab === "offices" && (
          <button
            onClick={openCreate}
            className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-800 transition"
          >
            + Add Office
          </button>
        )}
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {(["offices", "users"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition capitalize ${
              activeTab === tab
                ? "border-blue-700 text-blue-800"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {tab}
            {tab === "users" && pendingUsers.length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {pendingUsers.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── OFFICES TAB ── */}
      {activeTab === "offices" && (
        <>
          {officesLoading ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : offices.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-gray-400 text-sm">No offices yet.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["Office", "Code", "Head", "Designation", ""].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-gray-500 font-medium"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {offices.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {o.name}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{o.code}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {o.head_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {o.designation || "—"}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          onClick={() => openEdit(o)}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleOfficeDelete(o.id)}
                          className="text-red-500 hover:underline text-xs"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showForm && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
                <h2 className="text-lg font-semibold text-blue-900 mb-4">
                  {editTarget ? "Edit Office" : "Add Office"}
                </h2>
                <div className="space-y-3">
                  {[
                    {
                      label: "Office name",
                      key: "name",
                      placeholder:
                        "e.g. College of Information and Computing Technology",
                    },
                    { label: "Code", key: "code", placeholder: "e.g. CICT" },
                    {
                      label: "Office head name",
                      key: "head_name",
                      placeholder: "e.g. Juan Dela Cruz",
                    },
                    {
                      label: "Designation",
                      key: "designation",
                      placeholder: "e.g. Dean",
                    },
                  ].map(({ label, key, placeholder }) => (
                    <div key={key}>
                      <label className="text-xs text-gray-500 mb-1 block">
                        {label}
                      </label>
                      <input
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={officeForm[key as keyof typeof officeForm]}
                        onChange={(e) =>
                          setOfficeForm({
                            ...officeForm,
                            [key]: e.target.value,
                          })
                        }
                        placeholder={placeholder}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleOfficeSave}
                    disabled={
                      officeSaving || !officeForm.name || !officeForm.code
                    }
                    className="px-4 py-2 bg-blue-700 text-white text-sm rounded-lg hover:bg-blue-800 disabled:opacity-50 transition"
                  >
                    {officeSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── USERS TAB ── */}
      {activeTab === "users" && (
        <>
          {usersError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">
              {usersError}
            </div>
          )}

          {/* User sub-tabs */}
          <div className="flex gap-1 mb-4">
            <button
              onClick={() => setUserSubTab("pending")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                userSubTab === "pending"
                  ? "bg-yellow-100 text-yellow-800"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              Pending Approval
              {pendingUsers.length > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {pendingUsers.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setUserSubTab("active")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                userSubTab === "active"
                  ? "bg-blue-100 text-blue-800"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              Active Users ({activeUsers.length})
            </button>
          </div>

          {usersLoading ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : userSubTab === "pending" ? (
            pendingUsers.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <p className="text-gray-400 text-sm">No pending accounts.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {["Name", "Email", "Signed up", ""].map((h) => (
                        <th
                          key={h}
                          className="text-left px-4 py-3 text-gray-500 font-medium"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pendingUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {u.full_name}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{u.email}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          Awaiting approval
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => approveUser(u.id)}
                            className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-700 transition"
                          >
                            Approve
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : activeUsers.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-gray-400 text-sm">No active users yet.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {[
                      "Name",
                      "Email",
                      "Designation",
                      "Role",
                      "Offices",
                      "",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-gray-500 font-medium"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activeUsers.map((u) =>
                    editUserId === u.id ? (
                      <tr key={u.id} className="bg-blue-50">
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {u.full_name}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {u.email}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={userEditForm.designation}
                            onChange={(e) =>
                              setUserEditForm({
                                ...userEditForm,
                                designation: e.target.value,
                              })
                            }
                            placeholder="e.g. Staff, Dean"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={userEditForm.role}
                            onChange={(e) =>
                              setUserEditForm({
                                ...userEditForm,
                                role: e.target.value,
                              })
                            }
                          >
                            <option value="user">user</option>
                            <option value="admin">admin</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {offices.map((o) => (
                              <button
                                key={o.id}
                                type="button"
                                onClick={() => toggleOffice(o.id)}
                                className={`text-xs px-2 py-1 rounded-full border transition ${
                                  userEditForm.office_ids.includes(o.id)
                                    ? "bg-blue-700 text-white border-blue-700"
                                    : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                                }`}
                              >
                                {o.code}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                          <button
                            onClick={() => saveUserEdit(u.id)}
                            disabled={userSaving}
                            className="text-blue-600 hover:underline text-xs disabled:opacity-50"
                          >
                            {userSaving ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={() => setEditUserId(null)}
                            className="text-gray-400 hover:underline text-xs"
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {u.full_name}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {u.email}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {u.designation || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${
                              u.role === "admin"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {u.offices.length > 0 ? (
                              u.offices.map((o) => (
                                <span
                                  key={o.id}
                                  className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full"
                                >
                                  {o.code}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-gray-400">
                                None assigned
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => openUserEdit(u)}
                            className="text-blue-600 hover:underline text-xs"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
