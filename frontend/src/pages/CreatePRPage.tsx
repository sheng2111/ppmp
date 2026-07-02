import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

interface PRItemForm {
  lot_label: string;
  stock_property_no: string;
  unit: string;
  item_description: string;
  quantity: string;
  unit_price: string;
  is_lot_header: boolean;
}

const emptyItem = (): PRItemForm => ({
  lot_label: "",
  stock_property_no: "",
  unit: "",
  item_description: "",
  quantity: "",
  unit_price: "",
  is_lot_header: false,
});

export default function CreatePRPage() {
  const { dbUser } = useAuth();
  const navigate = useNavigate();

  const [officeId, setOfficeId] = useState<string>("");
  const [prNumber, setPrNumber] = useState("");
  const [fundCluster, setFundCluster] = useState("");
  const [responsibilityCode, setResponsibilityCode] = useState("");
  const [requestedDate, setRequestedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [purpose, setPurpose] = useState("");
  const [requestedByName, setRequestedByName] = useState("");
  const [requestedByDesignation, setRequestedByDesignation] = useState("");
  const [approvedByName, setApprovedByName] = useState("");
  const [approvedByDesignation, setApprovedByDesignation] = useState("");
  const [items, setItems] = useState<PRItemForm[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const assignedOffices = ((dbUser as any)?.offices || []) as {
    id: number | string;
    name: string;
    code?: string;
  }[];

  useEffect(() => {
    if (assignedOffices.length === 1) {
      setOfficeId(String(assignedOffices[0].id));
    }
  }, [dbUser]);

  const updateItem = (
    index: number,
    field: keyof PRItemForm,
    value: string | boolean,
  ) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  const addLotHeader = () => {
    setItems((prev) => [
      ...prev,
      {
        ...emptyItem(),
        is_lot_header: true,
        lot_label: `Lot ${String.fromCharCode(65 + prev.filter((i) => i.is_lot_header).length)}`,
      },
    ]);
  };

  const removeItem = (index: number) =>
    setItems((prev) => prev.filter((_, i) => i !== index));

  const grandTotal = items
    .filter((i) => !i.is_lot_header)
    .reduce(
      (sum, i) =>
        sum + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0),
      0,
    );

  const handleSubmit = async () => {
    if (!officeId) {
      setError("Please select an office.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        pr_number: prNumber || null,
        fund_cluster: fundCluster || null,
        responsibility_center_code: responsibilityCode || null,
        purpose,
        requested_date: requestedDate,
        requested_by_name: requestedByName,
        requested_by_designation: requestedByDesignation,
        approved_by_name: approvedByName,
        approved_by_designation: approvedByDesignation,
        items: items.map((i) => ({
          lot_label: i.is_lot_header ? i.lot_label : null,
          stock_property_no: i.stock_property_no || null,
          unit: i.unit || null,
          item_description: i.is_lot_header ? i.lot_label : i.item_description,
          quantity: i.is_lot_header ? 0 : parseFloat(i.quantity) || 0,
          unit_price: i.is_lot_header ? 0 : parseFloat(i.unit_price) || 0,
        })),
      };
      const res = await api.post("/prs/", payload, {
        params: { office_id: Number(officeId), created_by: dbUser?.id },
      });
      navigate(`/prs/${res.data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to save PR.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-blue-900">
            Create Purchase Request
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Fill in the details of your purchase request
          </p>
        </div>
        <button
          onClick={() => navigate("/prs")}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="text-sm font-semibold text-blue-900 mb-4">PR Header</h2>
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Office <span className="text-red-400">*</span>
            </label>
            {assignedOffices.length === 0 ? (
              <p className="text-xs text-red-500 mt-1">
                No assigned offices. Contact the admin.
              </p>
            ) : (
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={officeId}
                onChange={(e) => setOfficeId(e.target.value)}
              >
                <option value="" disabled>
                  Select an office...
                </option>
                {assignedOffices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.code})
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              PR Number
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={prNumber}
              onChange={(e) => setPrNumber(e.target.value)}
              placeholder="e.g. PR-2027-001"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Date</label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={requestedDate}
              onChange={(e) => setRequestedDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Fund Cluster
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={fundCluster}
              onChange={(e) => setFundCluster(e.target.value)}
              placeholder="e.g. 01"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">
            Responsibility Center Code
          </label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={responsibilityCode}
            onChange={(e) => setResponsibilityCode(e.target.value)}
            placeholder="e.g. 10101010"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-semibold text-blue-900">Items</h2>
          <div className="flex gap-2">
            <button
              onClick={addLotHeader}
              className="text-xs text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition"
            >
              + Add Lot
            </button>
            <button
              onClick={addItem}
              className="text-xs text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition"
            >
              + Add Item
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-2 py-2 text-gray-500 font-medium w-24">
                  Stock/Prop No.
                </th>
                <th className="text-left px-2 py-2 text-gray-500 font-medium w-16">
                  Unit
                </th>
                <th className="text-left px-2 py-2 text-gray-500 font-medium">
                  Item Description
                </th>
                <th className="text-right px-2 py-2 text-gray-500 font-medium w-20">
                  Qty
                </th>
                <th className="text-right px-2 py-2 text-gray-500 font-medium w-24">
                  Unit Price
                </th>
                <th className="text-right px-2 py-2 text-gray-500 font-medium w-24">
                  Total
                </th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, i) =>
                item.is_lot_header ? (
                  <tr key={i} className="bg-blue-50">
                    <td colSpan={5} className="px-2 py-2">
                      <input
                        className="text-xs font-semibold text-blue-800 bg-transparent border-b border-dashed border-blue-300 focus:outline-none w-32"
                        value={item.lot_label}
                        onChange={(e) =>
                          updateItem(i, "lot_label", e.target.value)
                        }
                      />
                    </td>
                    <td className="px-2 py-2 text-right text-gray-400">—</td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => removeItem(i)}
                        className="text-red-400 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={i}>
                    <td className="px-2 py-1.5">
                      <input
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        value={item.stock_property_no}
                        onChange={(e) =>
                          updateItem(i, "stock_property_no", e.target.value)
                        }
                        placeholder="Optional"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        value={item.unit}
                        onChange={(e) => updateItem(i, "unit", e.target.value)}
                        placeholder="pcs"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        value={item.item_description}
                        onChange={(e) =>
                          updateItem(i, "item_description", e.target.value)
                        }
                        placeholder="Item description"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(i, "quantity", e.target.value)
                        }
                        placeholder="0"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
                        value={item.unit_price}
                        onChange={(e) =>
                          updateItem(i, "unit_price", e.target.value)
                        }
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right text-gray-700 font-medium">
                      ₱
                      {(
                        (parseFloat(item.quantity) || 0) *
                        (parseFloat(item.unit_price) || 0)
                      ).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        onClick={() => removeItem(i)}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
            <tfoot>
              <tr className="bg-orange-50 font-semibold">
                <td colSpan={5} className="px-2 py-2 text-right text-sm">
                  Grand Total:
                </td>
                <td className="px-2 py-2 text-right text-sm text-blue-900">
                  ₱
                  {grandTotal.toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="mb-4">
          <label className="text-xs text-gray-500 mb-1 block">Purpose</label>
          <textarea
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="e.g. Office supplies for department use."
          />
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-medium text-gray-700 mb-2">
              Requested by:
            </p>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
              value={requestedByName}
              onChange={(e) => setRequestedByName(e.target.value)}
              placeholder="Full name"
            />
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={requestedByDesignation}
              onChange={(e) => setRequestedByDesignation(e.target.value)}
              placeholder="Designation"
            />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-700 mb-2">
              Approved by:
            </p>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
              value={approvedByName}
              onChange={(e) => setApprovedByName(e.target.value)}
              placeholder="Full name"
            />
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={approvedByDesignation}
              onChange={(e) => setApprovedByDesignation(e.target.value)}
              placeholder="Designation"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          onClick={() => navigate("/prs")}
          className="px-5 py-2 text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || assignedOffices.length === 0}
          className="px-5 py-2 bg-blue-700 text-white text-sm rounded-lg hover:bg-blue-800 disabled:opacity-50 transition"
        >
          {saving ? "Saving..." : "Save PR"}
        </button>
      </div>
    </div>
  );
}
