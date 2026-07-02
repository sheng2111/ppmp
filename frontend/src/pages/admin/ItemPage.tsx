import { useState, useEffect } from "react";
import api from "../../services/api";
import type { Item } from "../../types";

const CATEGORIES = [
  "Office Supplies",
  "IT Equipment",
  "Janitorial Supplies",
  "Furniture",
  "Other",
];

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

  const handleDelete = async (id: number) => {
    if (!confirm("Deactivate this item?")) return;
    await api.delete(`/items/${id}`);
    fetchItems();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-blue-900">Item Catalog</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage supplier items and prices
          </p>
        </div>
        <button
          onClick={openCreate}
          className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-800 transition"
        >
          + Add Item
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Search items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">No items found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">
                  Item name
                </th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">
                  Unit
                </th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">
                  Unit price
                </th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">
                  Category
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {item.name}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{item.unit}</td>
                  <td className="px-4 py-3 text-gray-800">
                    ₱
                    {item.unit_price.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {item.category && (
                      <span className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full">
                        {item.category}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => openEdit(item)}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
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
              {editTarget ? "Edit Item" : "Add Item"}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Item name
                </label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Bond Paper"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">
                    Unit
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="e.g. ream"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">
                    Unit price (₱)
                  </label>
                  <input
                    type="number"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.unit_price}
                    onChange={(e) =>
                      setForm({ ...form, unit_price: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Category
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={
                  saving || !form.name || !form.unit || !form.unit_price
                }
                className="px-4 py-2 bg-blue-700 text-white text-sm rounded-lg hover:bg-blue-800 disabled:opacity-50 transition"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
