import { useState, useEffect } from "react";
import api from "../../services/api";
import type { Item } from "../../types";
import { Plus, Search, Package, ClipboardPaste, Trash2 } from "lucide-react";
import { useToast } from "../../components/feedback/ToastProvider";
import { useConfirmState } from "../../components/feedback/useConfirm";
import { ConfirmDialog } from "../../components/feedback/ConfirmDialog";
import { LoadingButton } from "../../components/feedback/LoadingButton";
import { EmptyState } from "../../components/feedback/EmptyState";
import { SkeletonRow } from "../../components/feedback/Skeleton";
import PageHeader from "../../components/layout/PageHeader";

const CATEGORIES = [
  "Office Supplies",
  "IT Equipment",
  "Janitorial Supplies",
  "Furniture",
  "Other",
];

const INPUT =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition" +
  " focus:ring-[#009CC4]/40";

// A row parsed from bulk-pasted text, before it's saved.
type BulkRow = {
  name: string;
  unit: string;
  unit_price: string; // kept as string so the input stays editable
  category: string;
};

// Parses pasted spreadsheet-style rows into { unit, name, price }.
// Expected paste order (tab-separated): Unit  Item name  Unit price
// e.g. "pack\tBrown envelope, long (500 pcs/pack)\t 1,260.00"
// Falls back to splitting on 2+ spaces if there are no tabs (some
// paste sources strip tabs and leave aligned whitespace instead).
function parseBulkText(text: string, defaultCategory: string): BulkRow[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      let parts = line.split("\t").map((p) => p.trim());
      if (parts.length < 2) {
        parts = line.split(/\s{2,}/).map((p) => p.trim());
      }
      parts = parts.filter(Boolean);

      let unit = "";
      let name = "";
      let rawPrice = "";

      if (parts.length >= 3) {
        [unit, name, rawPrice] = parts;
      } else if (parts.length === 2) {
        // Only two columns found — assume name + price, unit left blank.
        [name, rawPrice] = parts;
      } else if (parts.length === 1) {
        name = parts[0];
      }

      const cleanedPrice = rawPrice.replace(/[₱,\s]/g, "");

      return {
        name,
        unit,
        unit_price: cleanedPrice,
        category: defaultCategory,
      };
    });
}

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Item | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [form, setForm] = useState({
    name: "",
    unit: "",
    unit_price: "",
    category: "",
  });
  const [saving, setSaving] = useState(false);

  // ── Bulk add state ──
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState("");

  const toast = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } =
    useConfirmState();

  const fetchItems = async () => {
    try {
      const res = await api.get("/items/");
      setItems(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const filtered = items.filter((item) => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory ? item.category === filterCategory : true;
    return matchSearch && matchCat;
  });

  const openCreate = () => {
    setEditTarget(null);
    setForm({ name: "", unit: "", unit_price: "", category: "" });
    setShowForm(true);
  };

  const openEdit = (item: Item) => {
    setEditTarget(item);
    setForm({
      name: item.name,
      unit: item.unit,
      unit_price: String(item.unit_price),
      category: item.category || "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, unit_price: parseFloat(form.unit_price) };
      if (editTarget) {
        await api.put(`/items/${editTarget.id}`, payload);
      } else {
        await api.post("/items/", payload);
      }
      setShowForm(false);
      fetchItems();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !(await confirm({
        title: "Deactivate Item",
        description: "Deactivate this item? It will no longer appear in the catalog.",
        confirmLabel: "Deactivate",
        tone: "danger",
      }))
    )
      return;
    await api.delete(`/items/${id}`);
    toast.success("Item deactivated.");
    fetchItems();
  };

  // ── Bulk add handlers ──

  const openBulk = () => {
    setBulkText("");
    setBulkCategory("");
    setBulkRows([]);
    setBulkError("");
    setShowBulkForm(true);
  };

  const handleParseBulk = () => {
    setBulkError("");
    if (!bulkText.trim()) return;
    const rows = parseBulkText(bulkText, bulkCategory);
    if (rows.length === 0) {
      setBulkError("Couldn't find any rows to parse.");
      return;
    }
    setBulkRows(rows);
  };

  const updateBulkRow = (
    index: number,
    field: keyof BulkRow,
    value: string,
  ) => {
    setBulkRows((rows) =>
      rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    );
  };

  const removeBulkRow = (index: number) => {
    setBulkRows((rows) => rows.filter((_, i) => i !== index));
  };

  const bulkValid = bulkRows.every(
    (r) =>
      r.name.trim() &&
      r.unit.trim() &&
      r.unit_price.trim() !== "" &&
      !isNaN(parseFloat(r.unit_price)),
  );

  const handleBulkSave = async () => {
    if (bulkRows.length === 0 || !bulkValid) return;
    setBulkSaving(true);
    setBulkError("");
    try {
      // Save sequentially so one bad row doesn't silently drop others
      // and we can report exactly which one failed.
      for (let i = 0; i < bulkRows.length; i++) {
        const row = bulkRows[i];
        const payload = {
          name: row.name.trim(),
          unit: row.unit.trim(),
          category: row.category,
          unit_price: parseFloat(row.unit_price),
        };
        await api.post("/items/", payload);
      }
      setShowBulkForm(false);
      setBulkRows([]);
      setBulkText("");
      fetchItems();
    } catch (err) {
      setBulkError(
        "Something went wrong while saving. Items added so far were kept — check the catalog and re-paste the rest.",
      );
      fetchItems();
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <div style={{ fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" }}>
      {/* ── Header ── */}
      <PageHeader
        title="Item Catalog"
        subtitle="Manage supplier items and prices"
        actions={
          <>
            <button
              onClick={openBulk}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition hover:opacity-90 active:scale-95 border bg-white/10 hover:bg-white/20"
              style={{ color: "#009CC4", borderColor: "#009CC4" }}
            >
              <ClipboardPaste className="w-4 h-4" />
              Bulk Add
            </button>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition hover:opacity-90 active:scale-95 bg-white/10 hover:bg-white/20"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          </>
        }
      />

      {/* ── Filters ── */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
          <input
            className={INPUT + " pl-9"}
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009CC4]/40 focus:border-transparent bg-white text-gray-600"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} columns={5} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Package className="w-8 h-8" style={{ color: "#B0BEC5" }} />}
          title="No items found"
          description="Add items to the catalog to start managing your supplies."
          action={{ label: "Add Item", onClick: openCreate }}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead
              style={{ background: "#F7FAFD" }}
              className="border-b border-gray-100"
            >
              <tr>
                {["Item name", "Unit", "Unit price", "Category", ""].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-[#F0F8FC]/60 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {item.name}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{item.unit}</td>
                  <td
                    className="px-4 py-3 font-medium"
                    style={{ color: "#061451" }}
                  >
                    ₱
                    {item.unit_price.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {item.category && (
                      <span
                        className="text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{
                          background: "rgba(0,156,196,0.08)",
                          color: "#009CC4",
                        }}
                      >
                        {item.category}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button
                      onClick={() => openEdit(item)}
                      className="text-xs font-medium transition hover:opacity-70"
                      style={{ color: "#009CC4" }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-xs font-medium text-red-400 hover:text-red-600 transition"
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

      {/* ── Single-item Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-gray-100">
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(0,156,196,0.1)" }}
              >
                <Package className="w-4 h-4" style={{ color: "#009CC4" }} />
              </div>
              <h2
                className="text-base font-semibold"
                style={{ color: "#061451" }}
              >
                {editTarget ? "Edit Item" : "Add Item"}
              </h2>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">
                  Item name
                </label>
                <input
                  className={INPUT}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Bond Paper"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">
                    Unit
                  </label>
                  <input
                    className={INPUT}
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="e.g. ream"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">
                    Unit price (₱)
                  </label>
                  <input
                    type="number"
                    className={INPUT}
                    value={form.unit_price}
                    onChange={(e) =>
                      setForm({ ...form, unit_price: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">
                  Category
                </label>
                <select
                  className={INPUT + " bg-white"}
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                >
                  <option value="">Select category</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-600 transition"
              >
                Cancel
              </button>
              <LoadingButton
                onClick={handleSave}
                disabled={!form.name || !form.unit || !form.unit_price}
                busy={saving}
                busyLabel="Saving…"
              >
                Save
              </LoadingButton>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Add Modal ── */}
      {showBulkForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-3xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(0,156,196,0.1)" }}
              >
                <ClipboardPaste
                  className="w-4 h-4"
                  style={{ color: "#009CC4" }}
                />
              </div>
              <div>
                <h2
                  className="text-base font-semibold"
                  style={{ color: "#061451" }}
                >
                  Bulk Add Items
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Paste rows copied from a spreadsheet: Unit, Item name, Unit
                  price (tab-separated)
                </p>
              </div>
            </div>

            {bulkRows.length === 0 ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">
                    Default category (optional, applied to all rows — you can
                    still edit per row)
                  </label>
                  <select
                    className={INPUT + " bg-white"}
                    value={bulkCategory}
                    onChange={(e) => setBulkCategory(e.target.value)}
                  >
                    <option value="">No category</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">
                    Paste data here
                  </label>
                  <textarea
                    className={INPUT + " font-mono"}
                    rows={8}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={
                      "pack\tBrown envelope, long (500 pcs/pack)\t1,260.00\nream\tBond paper, A4\t250.00"
                    }
                  />
                </div>
                {bulkError && (
                  <p className="text-xs text-red-500">{bulkError}</p>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-400">
                    {bulkRows.length} row{bulkRows.length !== 1 ? "s" : ""}{" "}
                    parsed — check and edit before saving
                  </p>
                  <button
                    onClick={() => setBulkRows([])}
                    className="text-xs font-medium text-gray-400 hover:text-gray-600"
                  >
                    ← Back to paste
                  </button>
                </div>
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead
                      style={{ background: "#F7FAFD" }}
                      className="border-b border-gray-100"
                    >
                      <tr>
                        {[
                          "Item name",
                          "Unit",
                          "Unit price",
                          "Category",
                          "",
                        ].map((h) => (
                          <th
                            key={h}
                            className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {bulkRows.map((row, i) => {
                        const priceInvalid =
                          row.unit_price.trim() === "" ||
                          isNaN(parseFloat(row.unit_price));
                        return (
                          <tr key={i}>
                            <td className="px-2 py-1.5">
                              <input
                                className={INPUT + " text-sm"}
                                value={row.name}
                                onChange={(e) =>
                                  updateBulkRow(i, "name", e.target.value)
                                }
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                className={INPUT + " text-sm"}
                                value={row.unit}
                                onChange={(e) =>
                                  updateBulkRow(i, "unit", e.target.value)
                                }
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                className={
                                  INPUT +
                                  " text-sm" +
                                  (priceInvalid ? " border-red-300" : "")
                                }
                                value={row.unit_price}
                                onChange={(e) =>
                                  updateBulkRow(i, "unit_price", e.target.value)
                                }
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <select
                                className={INPUT + " text-sm bg-white"}
                                value={row.category}
                                onChange={(e) =>
                                  updateBulkRow(i, "category", e.target.value)
                                }
                              >
                                <option value="">—</option>
                                {CATEGORIES.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <button
                                onClick={() => removeBulkRow(i)}
                                className="text-gray-300 hover:text-red-500 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!bulkValid && (
                  <p className="text-xs text-red-500 mt-2">
                    Some rows are missing a name, unit, or valid price — fix the
                    highlighted fields before saving.
                  </p>
                )}
                {bulkError && (
                  <p className="text-xs text-red-500 mt-2">{bulkError}</p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowBulkForm(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-600 transition"
              >
                Cancel
              </button>
              {bulkRows.length === 0 ? (
                <button
                  onClick={handleParseBulk}
                  disabled={!bulkText.trim()}
                  className="px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition hover:opacity-90"
                  style={{ background: "#061451" }}
                >
                  Parse
                </button>
              ) : (
                <LoadingButton
                  onClick={handleBulkSave}
                  disabled={!bulkValid}
                  busy={bulkSaving}
                  busyLabel={`Adding ${bulkRows.length} Item${bulkRows.length !== 1 ? "s" : ""}…`}
                >
                  Add {bulkRows.length} Item{bulkRows.length !== 1 ? "s" : ""}
                </LoadingButton>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        state={confirmState}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
}
