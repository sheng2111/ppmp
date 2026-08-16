import {
  useState,
  useEffect,
  type JSXElementConstructor,
  type Key,
  type ReactElement,
  type ReactNode,
  type ReactPortal,
} from "react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/feedback/ToastProvider";
import { useConfirmState } from "../../components/feedback/useConfirm";
import { ConfirmDialog } from "../../components/feedback/ConfirmDialog";
import { LoadingButton } from "../../components/feedback/LoadingButton";
import { EmptyState } from "../../components/feedback/EmptyState";
import { SkeletonRow } from "../../components/feedback/Skeleton";
// Local wrappers for fee-category API calls. The original project
// exported these from services/feeCategoryApi; keep compatible
// signatures here to avoid the missing-module error.
export interface FeeCategoryOffice {
  id: string;
  name: string;
  fee_category_id: string;
  parent_office_id?: string | null;
  children: FeeCategoryOffice[];
}

export interface FeeCategory {
  id: string;
  name: string;
  offices: FeeCategoryOffice[];
}

const getFeeCategoryTree = async (): Promise<FeeCategory[]> => {
  const res = await api.get("/fee-categories/tree");
  return res.data;
};

const createFeeCategory = async (name: string, position?: number) => {
  await api.post("/fee-categories", { name, position });
};

const updateFeeCategory = async (id: string, body: { name: string }) => {
  await api.put(`/fee-categories/${id}`, body);
};

const deleteFeeCategory = async (id: string) => {
  await api.delete(`/fee-categories/${id}`);
};

const createOffice = async (fee_category_id: string, body: any) => {
  await api.post(`/fee-categories/${fee_category_id}/offices`, body);
};

const updateOffice = async (id: string, body: any) => {
  await api.put(`/fee-categories/offices/${id}`, body);
};

const deleteOffice = async (id: string) => {
  await api.delete(`/fee-categories/offices/${id}`);
};
import { Plus, Building2, Users, ChevronRight, FolderTree } from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";

interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

// Offices a user has actually used, derived from the PPMPs they've created —
// not something an admin assigns anymore.
interface UserOfficeUsage {
  id: string;
  name: string;
}

const INPUT =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009CC4]/40 focus:border-transparent transition";

interface OfficeFormState {
  name: string;
  // Fixed for the lifetime of the modal — set when the form is opened from
  // a specific Fee Category's "Add Office" / "Add sub-office" action. The
  // API only supports creating an office under a category via
  // POST /fee-categories/{category_id}/offices and never lets an existing
  // office move to a different category, so there's no category picker
  // inside this form — only "which category was this opened from".
  fee_category_id: string;
  parent_office_id: string;
}

const EMPTY_OFFICE_FORM: OfficeFormState = {
  name: "",
  fee_category_id: "",
  parent_office_id: "",
};

interface CategoryFormState {
  name: string;
}

const EMPTY_CATEGORY_FORM: CategoryFormState = { name: "" };

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OfficesPage() {
  const { user: supabaseUser } = useAuth();
  const toast = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmState();
  const [activeTab, setActiveTab] = useState<"feeCategories" | "users">(
    "feeCategories",
  );

  // ── Fee Categories + Offices state ────────────────────────────────────
  const [categories, setCategories] = useState<FeeCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryEditTarget, setCategoryEditTarget] =
    useState<FeeCategory | null>(null);
  const [categoryForm, setCategoryForm] =
    useState<CategoryFormState>(EMPTY_CATEGORY_FORM);
  const [categorySaving, setCategorySaving] = useState(false);

  const [showOfficeForm, setShowOfficeForm] = useState(false);
  const [officeEditTarget, setOfficeEditTarget] =
    useState<FeeCategoryOffice | null>(null);
  const [officeForm, setOfficeForm] =
    useState<OfficeFormState>(EMPTY_OFFICE_FORM);
  const [officeSaving, setOfficeSaving] = useState(false);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  // user_id -> offices they've used across their PPMPs
  const [userOffices, setUserOffices] = useState<
    Record<string, UserOfficeUsage[]>
  >({});

  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [roleForm, setRoleForm] = useState("user");
  const [userSaving, setUserSaving] = useState(false);

  const fetchCategories = async () => {
    setCategoriesLoading(true);
    try {
      const data = await getFeeCategoryTree();
      setCategories(data);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!supabaseUser) return;
    setUsersLoading(true);
    try {
      const res = await api.get("/auth/users", {
        params: { requester_uid: supabaseUser.id },
      });
      setUsers(res.data);

      try {
        const officesRes = await api.get("/ppmps/offices-by-user", {
          params: { requester_uid: supabaseUser.id },
        });
        setUserOffices(officesRes.data);
      } catch {
        setUserOffices({});
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Could not load users.");
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);
  useEffect(() => {
    if (activeTab === "users") fetchUsers();
  }, [activeTab, supabaseUser]);

  // ── Fee Category CRUD ─────────────────────────────────────────────────

  const openCreateCategory = () => {
    setCategoryEditTarget(null);
    setCategoryForm(EMPTY_CATEGORY_FORM);
    setShowCategoryForm(true);
  };

  const openEditCategory = (c: FeeCategory) => {
    setCategoryEditTarget(c);
    setCategoryForm({ name: c.name });
    setShowCategoryForm(true);
  };

  const handleCategorySave = async () => {
    setCategorySaving(true);
    try {
      if (categoryEditTarget) {
        await updateFeeCategory(categoryEditTarget.id, {
          name: categoryForm.name,
        });
      } else {
        await createFeeCategory(categoryForm.name, categories.length);
      }
      setShowCategoryForm(false);
      toast.success(`Fee Category ${categoryEditTarget ? "updated" : "created"} successfully.`);
      fetchCategories();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Could not save Fee Category.");
    } finally {
      setCategorySaving(false);
    }
  };

  const handleCategoryDelete = async (c: FeeCategory) => {
    if (!(await confirm({
      title: "Delete Fee Category",
      description: `Are you sure you want to delete "${c.name}"? This will also remove all offices under it. This action cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    }))) return;
    try {
      await deleteFeeCategory(c.id);
      toast.success("Fee Category deleted successfully.");
      fetchCategories();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Could not delete Fee Category.");
    }
  };

  // ── Office CRUD ───────────────────────────────────────────────────────

  const openCreateOffice = (category: FeeCategory) => {
    setOfficeEditTarget(null);
    setOfficeForm({
      name: "",
      fee_category_id: category.id,
      parent_office_id: "",
    });
    setShowOfficeForm(true);
  };

  const openEditOffice = (category: FeeCategory, o: FeeCategoryOffice) => {
    setOfficeEditTarget(o);
    setOfficeForm({
      name: o.name,
      fee_category_id: category.id,
      parent_office_id: o.parent_office_id ?? "",
    });
    setShowOfficeForm(true);
  };

  const openAddSubOffice = (
    category: FeeCategory,
    parent: FeeCategoryOffice,
  ) => {
    setOfficeEditTarget(null);
    setOfficeForm({
      name: "",
      fee_category_id: category.id,
      parent_office_id: parent.id,
    });
    setShowOfficeForm(true);
  };

  const handleOfficeSave = async () => {
    setOfficeSaving(true);
    try {
      if (officeEditTarget) {
        await updateOffice(officeEditTarget.id, {
          name: officeForm.name,
          parent_office_id: officeForm.parent_office_id || null,
        });
      } else {
        await createOffice(officeForm.fee_category_id, {
          name: officeForm.name,
          parent_office_id: officeForm.parent_office_id || null,
        });
      }
      setShowOfficeForm(false);
      toast.success(`Office ${officeEditTarget ? "updated" : "created"} successfully.`);
      fetchCategories();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Could not save office.");
    } finally {
      setOfficeSaving(false);
    }
  };

  const handleOfficeDelete = async (o: any) => {
    if (!(await confirm({
      title: "Delete Office",
      description: `Are you sure you want to delete "${o.name}"? This action cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    }))) return;
    try {
      await deleteOffice(o.id);
      toast.success("Office deleted successfully.");
      fetchCategories();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Could not delete office.");
    }
  };

  const openUserEdit = (u: AdminUser) => {
    setEditUserId(u.id);
    setRoleForm(u.role);
  };

  const saveUserEdit = async (userId: string) => {
    if (!supabaseUser) return;
    setUserSaving(true);
    try {
      await api.put(
        `/auth/users/${userId}`,
        { role: roleForm },
        { params: { requester_uid: supabaseUser.id } },
      );
      setEditUserId(null);
      toast.success("User role updated successfully.");
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Could not update user.");
    } finally {
      setUserSaving(false);
    }
  };

  const deleteUser = async (u: AdminUser) => {
    if (!supabaseUser) return;
    if (!(await confirm({
      title: "Delete User",
      description: `Are you sure you want to delete ${u.full_name} (${u.email})? This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    }))) return;
    try {
      await api.delete(`/auth/users/${u.id}`, {
        params: { requester_uid: supabaseUser.id },
      });
      toast.success("User deleted successfully.");
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Could not delete user.");
    }
  };

  const thCls =
    "text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide";
  const tdCls = "px-4 py-3";

  // Only top-level offices in the form's category are valid parents — the
  // API only allows one level of sub-office nesting, and an office can't
  // be its own parent.
  const activeCategory = categories.find(
    (c) => c.id === officeForm.fee_category_id,
  );
  const validParentOffices = (activeCategory?.offices ?? []).filter(
    (o: { id: any }) => {
      return o.id !== officeEditTarget?.id;
    },
  );

  return (
    <div style={{ fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" }}>
      {/* ── Header ── */}
      <PageHeader
        title={activeTab === "feeCategories" ? "Fee Categories" : "Users"}
        subtitle={
          activeTab === "feeCategories"
            ? "Manage fee categories and the offices/departments under them"
            : "Manage user accounts and roles"
        }
        actions={
          activeTab === "feeCategories" ? (
            <button
              onClick={openCreateCategory}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition hover:opacity-90 active:scale-95 bg-white/10 hover:bg-white/20"
            >
              <Plus className="w-4 h-4" /> Add Fee Category
            </button>
          ) : undefined
        }
      />

      {/* ── Main tabs ── */}
      <div className="flex gap-0 mb-5 border-b border-gray-100">
        {(
          [
            { key: "feeCategories", label: "Fee Categories", icon: FolderTree },
            { key: "users", label: "Users", icon: Users },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === key
                ? "border-[#009CC4] text-[#009CC4]"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── FEE CATEGORIES TAB ── */}
      {activeTab === "feeCategories" && (
        <>
          {categoriesLoading ? (
            <div className="space-y-4">
              <SkeletonRow columns={3} />
              <SkeletonRow columns={3} />
            </div>
          ) : categories.length === 0 ? (
            <EmptyState
              title="No Fee Categories yet"
              description="Create your first fee category to organize offices."
              action={{ label: "Add Fee Category", onClick: openCreateCategory }}
            />
          ) : (
            <div className="space-y-4">
              {categories.map((category) => {
                const officeCount = category.offices.reduce<number>(
                  (n: number, o: { children: string | any[] }) =>
                    n + 1 + o.children.length,
                  0,
                );
                return (
                  <div
                    key={category.id}
                    className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm"
                  >
                    <div
                      className="flex items-center justify-between px-4 py-3 border-b border-gray-100"
                      style={{ background: "#F7FAFD" }}
                    >
                      <div className="flex items-center gap-2">
                        <FolderTree
                          className="w-4 h-4"
                          style={{ color: "#009CC4" }}
                        />
                        <span
                          className="text-sm font-semibold"
                          style={{ color: "#061451" }}
                        >
                          {category.name}
                        </span>
                        <span className="text-xs text-gray-400">
                          {officeCount} office{officeCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="space-x-3">
                        <button
                          onClick={() => openCreateOffice(category)}
                          className="text-xs font-medium transition hover:opacity-70"
                          style={{ color: "#009CC4" }}
                        >
                          Add Office
                        </button>
                        <button
                          onClick={() => openEditCategory(category)}
                          className="text-xs font-medium transition hover:opacity-70"
                          style={{ color: "#009CC4" }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleCategoryDelete(category)}
                          className="text-xs font-medium text-red-400 hover:text-red-600 transition"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {category.offices.length === 0 ? (
                      <p className="px-4 py-4 text-sm text-gray-400">
                        No offices under this category yet.
                      </p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="border-b border-gray-50">
                          <tr>
                            {["Office", ""].map((h) => (
                              <th key={h} className={thCls}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {category.offices.map(
                            (o: {
                              id: Key | null | undefined;
                              name:
                                | string
                                | number
                                | bigint
                                | boolean
                                | ReactElement<
                                    unknown,
                                    string | JSXElementConstructor<any>
                                  >
                                | Iterable<ReactNode>
                                | ReactPortal
                                | Promise<
                                    | string
                                    | number
                                    | bigint
                                    | boolean
                                    | ReactPortal
                                    | ReactElement<
                                        unknown,
                                        string | JSXElementConstructor<any>
                                      >
                                    | Iterable<ReactNode>
                                    | null
                                    | undefined
                                  >
                                | null
                                | undefined;
                              children: {
                                id: Key | null | undefined;
                                name:
                                  | string
                                  | number
                                  | bigint
                                  | boolean
                                  | ReactElement<
                                      unknown,
                                      string | JSXElementConstructor<any>
                                    >
                                  | Iterable<ReactNode>
                                  | ReactPortal
                                  | Promise<
                                      | string
                                      | number
                                      | bigint
                                      | boolean
                                      | ReactPortal
                                      | ReactElement<
                                          unknown,
                                          string | JSXElementConstructor<any>
                                        >
                                      | Iterable<ReactNode>
                                      | null
                                      | undefined
                                    >
                                  | null
                                  | undefined;
                              }[];
                            }) => (
                              <>
                                <tr
                                  key={o.id}
                                  className="hover:bg-[#F0F8FC]/50 transition-colors"
                                >
                                  <td
                                    className={
                                      tdCls + " font-medium text-gray-800"
                                    }
                                  >
                                    {o.name}
                                  </td>
                                  <td
                                    className={tdCls + " text-right space-x-3"}
                                  >
                                    <button
                                      onClick={() =>
                                        openAddSubOffice(category, {
                                          ...(o as FeeCategoryOffice),
                                          fee_category_id: category.id,
                                        })
                                      }
                                      className="text-xs font-medium transition hover:opacity-70"
                                      style={{ color: "#009CC4" }}
                                    >
                                      Add sub-office
                                    </button>
                                    <button
                                      onClick={() =>
                                        openEditOffice(category, {
                                          ...(o as FeeCategoryOffice),
                                          fee_category_id: category.id,
                                        })
                                      }
                                      className="text-xs font-medium transition hover:opacity-70"
                                      style={{ color: "#009CC4" }}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleOfficeDelete(o)}
                                      className="text-xs font-medium text-red-400 hover:text-red-600 transition"
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                                {o.children.map(
                                  (child: {
                                    id: Key | null | undefined;
                                    name:
                                      | string
                                      | number
                                      | bigint
                                      | boolean
                                      | ReactElement<
                                          unknown,
                                          string | JSXElementConstructor<any>
                                        >
                                      | Iterable<ReactNode>
                                      | ReactPortal
                                      | Promise<
                                          | string
                                          | number
                                          | bigint
                                          | boolean
                                          | ReactPortal
                                          | ReactElement<
                                              unknown,
                                              | string
                                              | JSXElementConstructor<any>
                                            >
                                          | Iterable<ReactNode>
                                          | null
                                          | undefined
                                        >
                                      | null
                                      | undefined;
                                  }) => (
                                    <tr
                                      key={child.id}
                                      className="hover:bg-[#F0F8FC]/50 transition-colors bg-gray-50/40"
                                    >
                                      <td
                                        className={
                                          tdCls +
                                          " text-gray-600 pl-8 flex items-center gap-1.5"
                                        }
                                      >
                                        <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                                        {child.name}
                                      </td>
                                      <td
                                        className={
                                          tdCls + " text-right space-x-3"
                                        }
                                      >
                                        <button
                                          onClick={() =>
                                            openEditOffice(category, child as FeeCategoryOffice)
                                          }
                                          className="text-xs font-medium transition hover:opacity-70"
                                          style={{ color: "#009CC4" }}
                                        >
                                          Edit
                                        </button>
                                        <button
                                          onClick={() =>
                                            handleOfficeDelete(child)
                                          }
                                          className="text-xs font-medium text-red-400 hover:text-red-600 transition"
                                        >
                                          Delete
                                        </button>
                                      </td>
                                    </tr>
                                  ),
                                )}
                              </>
                            ),
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Fee Category modal */}
          {showCategoryForm && (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-gray-100">
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(0,156,196,0.1)" }}
                  >
                    <FolderTree
                      className="w-4 h-4"
                      style={{ color: "#009CC4" }}
                    />
                  </div>
                  <h2
                    className="text-base font-semibold"
                    style={{ color: "#061451" }}
                  >
                    {categoryEditTarget
                      ? "Edit Fee Category"
                      : "Add Fee Category"}
                  </h2>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">
                    Category name
                  </label>
                  <input
                    className={INPUT}
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ name: e.target.value })}
                    placeholder="e.g. Laboratory Fees"
                  />
                </div>

                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => setShowCategoryForm(false)}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-gray-600 transition"
                  >
                    Cancel
                  </button>
                  <LoadingButton
                    onClick={handleCategorySave}
                    disabled={!categoryForm.name}
                    busy={categorySaving}
                    busyLabel="Saving..."
                  >
                    Save
                  </LoadingButton>
                </div>
              </div>
            </div>
          )}

          {/* Office modal */}
          {showOfficeForm && (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-gray-100">
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(0,156,196,0.1)" }}
                  >
                    <Building2
                      className="w-4 h-4"
                      style={{ color: "#009CC4" }}
                    />
                  </div>
                  <div>
                    <h2
                      className="text-base font-semibold"
                      style={{ color: "#061451" }}
                    >
                      {officeEditTarget ? "Edit Office" : "Add Office"}
                    </h2>
                    <p className="text-xs text-gray-400">
                      {activeCategory?.name}
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1.5 block">
                      Office name
                    </label>
                    <input
                      className={INPUT}
                      value={officeForm.name}
                      onChange={(e) =>
                        setOfficeForm({ ...officeForm, name: e.target.value })
                      }
                      placeholder="e.g. CITE/BSCS"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1.5 block">
                      Parent office (optional)
                    </label>
                    <select
                      className={INPUT}
                      value={officeForm.parent_office_id}
                      onChange={(e) =>
                        setOfficeForm({
                          ...officeForm,
                          parent_office_id: e.target.value,
                        })
                      }
                    >
                      <option value="">— Top-level office —</option>
                      {validParentOffices.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => setShowOfficeForm(false)}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-gray-600 transition"
                  >
                    Cancel
                  </button>
                  <LoadingButton
                    onClick={handleOfficeSave}
                    disabled={!officeForm.name}
                    busy={officeSaving}
                    busyLabel="Saving..."
                  >
                    Save
                  </LoadingButton>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── USERS TAB ── */}
      {activeTab === "users" && (
        <>
          {usersLoading ? (
            <div className="space-y-4">
              <SkeletonRow columns={5} />
              <SkeletonRow columns={5} />
            </div>
          ) : users.length === 0 ? (
            <EmptyState
              title="No users yet"
              description="No user accounts have been registered yet."
            />
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead
                  style={{ background: "#F7FAFD" }}
                  className="border-b border-gray-100"
                >
                  <tr>
                    {["Name", "Email", "Role", "Offices used", ""].map((h) => (
                      <th key={h} className={thCls}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map((u) =>
                    editUserId === u.id ? (
                      <tr key={u.id} className="bg-[#F0F8FC]">
                        <td className={tdCls + " font-medium text-gray-800"}>
                          {u.full_name}
                        </td>
                        <td className={tdCls + " text-gray-400 text-xs"}>
                          {u.email}
                        </td>
                        <td className={tdCls}>
                          <select
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#009CC4]/40 bg-white"
                            value={roleForm}
                            onChange={(e) => setRoleForm(e.target.value)}
                          >
                            <option value="user">user</option>
                            <option value="admin">admin</option>
                          </select>
                        </td>
                        <td className={tdCls + " text-gray-300 text-xs"}>—</td>
                        <td
                          className={
                            tdCls + " text-right space-x-2 whitespace-nowrap"
                          }
                        >
                          <button
                            onClick={() => saveUserEdit(u.id)}
                            disabled={userSaving}
                            className="text-xs font-semibold disabled:opacity-50 transition hover:opacity-70"
                            style={{ color: "#009CC4" }}
                          >
                            {userSaving ? "Saving…" : "Save"}
                          </button>
                          <button
                            onClick={() => setEditUserId(null)}
                            className="text-xs text-gray-400 hover:text-gray-600 transition"
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    ) : (
                      <tr
                        key={u.id}
                        className="hover:bg-[#F0F8FC]/50 transition-colors"
                      >
                        <td className={tdCls + " font-medium text-gray-800"}>
                          {u.full_name}
                        </td>
                        <td className={tdCls + " text-gray-400 text-xs"}>
                          {u.email}
                        </td>
                        <td className={tdCls}>
                          <span
                            className="text-xs px-2.5 py-1 rounded-full font-semibold capitalize"
                            style={
                              u.role === "admin"
                                ? {
                                    background: "rgba(6,20,81,0.08)",
                                    color: "#061451",
                                  }
                                : { background: "#F3F4F6", color: "#6B7280" }
                            }
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className={tdCls}>
                          <div className="flex flex-wrap gap-1">
                            {(userOffices[u.id]?.length ?? 0) > 0 ? (
                              userOffices[u.id].map((o) => (
                                <span
                                  key={o.id}
                                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                                  style={{
                                    background: "rgba(0,156,196,0.1)",
                                    color: "#009CC4",
                                  }}
                                >
                                  {o.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-gray-300">
                                No PPMPs yet
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          className={
                            tdCls + " text-right whitespace-nowrap space-x-3"
                          }
                        >
                          <button
                            onClick={() => openUserEdit(u)}
                            className="text-xs font-medium transition hover:opacity-70"
                            style={{ color: "#009CC4" }}
                          >
                            Edit role
                          </button>
                          <button
                            onClick={() => deleteUser(u)}
                            className="text-xs font-medium text-red-400 hover:text-red-600 transition"
                          >
                            Delete
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

      {/* Global confirmation dialog */}
      <ConfirmDialog
        state={confirmState}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
}
