import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import API from "../services/api";
import codeOptionsRaw from "../data/codeOptions.json";
import modeOptionsRaw from "../data/modeOptions.json";
import unitOptionsRaw from "../data/unitOptions.json";

// --- Types ---
interface MonthSchedule {
  jan_qty: number;
  jan_amt: number;
  feb_qty: number;
  feb_amt: number;
  mar_qty: number;
  mar_amt: number;
  apr_qty: number;
  apr_amt: number;
  may_qty: number;
  may_amt: number;
  jun_qty: number;
  jun_amt: number;
  jul_qty: number;
  jul_amt: number;
  aug_qty: number;
  aug_amt: number;
  sep_qty: number;
  sep_amt: number;
  oct_qty: number;
  oct_amt: number;
  nov_qty: number;
  nov_amt: number;
  dec_qty: number;
  dec_amt: number;
}

interface PPMPItem {
  id?: number;
  localId: string;
  code: string;
  general_description: string;
  unit_of_issue: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  mode_of_procurement: string;
  pap_category: string;
  schedule: MonthSchedule;
}

// --- Constants ---
const MONTHS = [
  { key: "jan", label: "January" },
  { key: "feb", label: "February" },
  { key: "mar", label: "March" },
  { key: "apr", label: "April" },
  { key: "may", label: "May" },
  { key: "jun", label: "June" },
  { key: "jul", label: "July" },
  { key: "aug", label: "August" },
  { key: "sep", label: "September" },
  { key: "oct", label: "October" },
  { key: "nov", label: "November" },
  { key: "dec", label: "December" },
];

const QUARTERS = [
  { label: "Q1 — Jan to Mar", months: ["jan", "feb", "mar"] },
  { label: "Q2 — Apr to Jun", months: ["apr", "may", "jun"] },
  { label: "Q3 — Jul to Sep", months: ["jul", "aug", "sep"] },
  { label: "Q4 — Oct to Dec", months: ["oct", "nov", "dec"] },
];

const MODE_OPTIONS: string[] = modeOptionsRaw;

const PAP_CATEGORIES = [
  "Faculty Development",
  "Curriculum Development",
  "Student Development",
  "Research",
  "Extension",
  "Administration",
  "Maintenance",
  "Equipment",
  "Others",
];

const CODE_OPTIONS: string[] = codeOptionsRaw;
const UNIT_OPTIONS: string[] = unitOptionsRaw;
const FUND_OPTIONS = ["STF", "GAA", "IGP", "Trust Fund", "Others"];

const emptySchedule = (): MonthSchedule => ({
  jan_qty: 0,
  jan_amt: 0,
  feb_qty: 0,
  feb_amt: 0,
  mar_qty: 0,
  mar_amt: 0,
  apr_qty: 0,
  apr_amt: 0,
  may_qty: 0,
  may_amt: 0,
  jun_qty: 0,
  jun_amt: 0,
  jul_qty: 0,
  jul_amt: 0,
  aug_qty: 0,
  aug_amt: 0,
  sep_qty: 0,
  sep_amt: 0,
  oct_qty: 0,
  oct_amt: 0,
  nov_qty: 0,
  nov_amt: 0,
  dec_qty: 0,
  dec_amt: 0,
});

const emptyItem = (): PPMPItem => ({
  localId: Date.now().toString() + Math.random().toString(36).slice(2),
  code: "",
  general_description: "",
  unit_of_issue: "piece",
  quantity: 0,
  unit_cost: 0,
  total_cost: 0,
  mode_of_procurement: "small value procurement",
  pap_category: "Faculty Development",
  schedule: emptySchedule(),
});

// --- Reusable UI Components (compact spacing) ---
const Field = ({
  label,
  children,
  hint,
  required,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
}) => (
  <div>
    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {hint && <p className="text-[10px] text-gray-400 mt-0.5">{hint}</p>}
  </div>
);

const inputClass =
  "w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-transparent transition leading-normal";

const selectClass =
  "w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-transparent transition leading-normal appearance-none";

// --- Searchable Combobox Component ---
const SearchableSelect = ({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const [typing, setTyping] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setTyping(false);
        setQuery(value || "");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  const filtered =
    typing && query
      ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
      : options;

  const handleSelect = (opt: string) => {
    onChange(opt);
    setQuery(opt);
    setOpen(false);
    setTyping(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setTyping(true);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder || "Search or select..."}
        className={inputClass}
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400">
              No matches found
            </div>
          ) : (
            filtered.map((opt) => (
              <div
                key={opt}
                onClick={() => handleSelect(opt)}
                className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-blue-50 transition ${
                  opt === value
                    ? "bg-blue-50 text-blue-800 font-semibold"
                    : "text-gray-700"
                }`}
              >
                {opt}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// --- Step Indicator ---
const StepIndicator = ({ step }: { step: number }) => (
  <div className="flex items-center gap-2 mb-2">
    {[0, 1].map((i) => (
      <React.Fragment key={i}>
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
            i < step
              ? "bg-blue-800 text-white"
              : i === step
                ? "bg-white border-2 border-blue-800 text-blue-800"
                : "bg-gray-200 text-gray-400"
          }`}
        >
          {i < step ? "✓" : i + 1}
        </div>
        {i < 1 && (
          <div
            className={`flex-1 h-1 rounded ${i < step ? "bg-blue-800" : "bg-gray-200"}`}
          />
        )}
      </React.Fragment>
    ))}
  </div>
);

// --- Item Card Component ---
const ItemCard = ({
  item,
  index,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onDelete,
  onDuplicate,
  canDelete,
}: {
  item: PPMPItem;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (localId: string, updated: PPMPItem) => void;
  onDelete: (localId: string) => void;
  onDuplicate: (item: PPMPItem) => void;
  canDelete: boolean;
}) => {
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // Track whether the code/mode fields are showing a "custom" text input
  // (i.e. the saved value isn't one of the predefined options)
  const codeIsCustom = item.code !== "" && !CODE_OPTIONS.includes(item.code);
  const modeIsCustom =
    item.mode_of_procurement !== "" &&
    !MODE_OPTIONS.includes(item.mode_of_procurement);

  const [codeCustomMode, setCodeCustomMode] = useState(codeIsCustom);
  const [modeCustomMode, setModeCustomMode] = useState(modeIsCustom);

  const update = (field: keyof PPMPItem, value: any) => {
    const updated = { ...item, [field]: value };
    if (field === "quantity" || field === "unit_cost") {
      updated.total_cost = updated.quantity * updated.unit_cost;
    }
    onUpdate(item.localId, updated);
  };

  const updateScheduleQty = (month: string, qty: number) => {
    const amt = qty * item.unit_cost;
    const newSchedule = {
      ...item.schedule,
      [`${month}_qty`]: qty,
      [`${month}_amt`]: amt,
    };
    const totalQty = MONTHS.reduce(
      (sum, m) => sum + ((newSchedule as any)[`${m.key}_qty`] || 0),
      0,
    );
    const updated = {
      ...item,
      schedule: newSchedule,
      quantity: totalQty,
      total_cost: totalQty * item.unit_cost,
    };
    onUpdate(item.localId, updated);
  };

  const scheduleTotal = MONTHS.reduce(
    (sum, m) => sum + ((item.schedule as any)[`${m.key}_qty`] || 0),
    0,
  );

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition rounded-xl"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #1e3a6e, #2471c8)" }}
          >
            {index + 1}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">
              {item.general_description || "New Item"}
            </p>
            <p className="text-xs text-gray-400">
              {item.pap_category} •{" "}
              {item.total_cost > 0
                ? `₱${item.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                : "No cost set"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(item);
            }}
            className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition"
          >
            Duplicate
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.localId);
              }}
              className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition"
            >
              Remove
            </button>
          )}
          <span className="text-gray-400 text-sm">
            {isExpanded ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="PAP Category">
              <select
                value={item.pap_category}
                onChange={(e) => update("pap_category", e.target.value)}
                className={selectClass}
              >
                {PAP_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>

            <Field label="Mode of Procurement">
              {modeCustomMode ? (
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={item.mode_of_procurement}
                    onChange={(e) =>
                      update("mode_of_procurement", e.target.value)
                    }
                    className={inputClass}
                    placeholder="Specify mode of procurement"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setModeCustomMode(false);
                      update("mode_of_procurement", MODE_OPTIONS[0]);
                    }}
                    className="text-xs text-gray-400 hover:text-gray-600 px-2"
                    title="Back to list"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <SearchableSelect
                  value={item.mode_of_procurement}
                  onChange={(val) => {
                    if (val === "Others (Specify)") {
                      setModeCustomMode(true);
                      update("mode_of_procurement", "");
                    } else {
                      update("mode_of_procurement", val);
                    }
                  }}
                  options={MODE_OPTIONS}
                  placeholder="Search mode of procurement..."
                />
              )}
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field
              label="Account Code / Classification"
              required
              hint="Type to search"
            >
              {codeCustomMode ? (
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={item.code}
                    onChange={(e) => update("code", e.target.value)}
                    className={inputClass}
                    placeholder="Specify account code/classification"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCodeCustomMode(false);
                      update("code", CODE_OPTIONS[0]);
                    }}
                    className="text-xs text-gray-400 hover:text-gray-600 px-2"
                    title="Back to list"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <SearchableSelect
                  value={item.code}
                  onChange={(val) => {
                    if (val === "Others (Specify)") {
                      setCodeCustomMode(true);
                      update("code", "");
                    } else {
                      update("code", val);
                    }
                  }}
                  options={CODE_OPTIONS}
                  placeholder="Search account code..."
                />
              )}
            </Field>
            <Field label="General Description" required>
              <input
                type="text"
                value={item.general_description}
                onChange={(e) => update("general_description", e.target.value)}
                className={inputClass}
                placeholder="e.g. Bond Paper, A4, 80gsm"
                required
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Unit of Issue">
              <select
                value={item.unit_of_issue}
                onChange={(e) => update("unit_of_issue", e.target.value)}
                className={selectClass}
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </Field>
            <Field label="Total Qty" hint="Auto-sum">
              <div className="w-full border border-gray-100 bg-blue-50 rounded-lg px-3 py-2 text-sm font-bold text-blue-800">
                {item.quantity}
              </div>
            </Field>
            <Field label="Unit Cost (₱)" required>
              <input
                type="number"
                min={0.01}
                step="0.01"
                value={item.unit_cost || ""}
                onChange={(e) =>
                  update("unit_cost", parseFloat(e.target.value) || 0)
                }
                className={inputClass}
                placeholder="0.00"
                required
              />
            </Field>
            <Field label="Total Cost (₱)">
              <div className="w-full border border-gray-100 bg-green-50 rounded-lg px-3 py-2 text-sm font-bold text-green-700">
                ₱
                {item.total_cost.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </div>
            </Field>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setScheduleOpen(!scheduleOpen)}
              className="flex items-center gap-2 text-xs font-bold text-blue-700 hover:text-blue-900 transition"
            >
              <span>{scheduleOpen ? "▲" : "▼"}</span>
              Monthly Schedule
              {scheduleTotal > 0 && (
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                  {scheduleTotal} units scheduled
                </span>
              )}
            </button>

            {scheduleOpen && (
              <div className="mt-2 space-y-2">
                {QUARTERS.map(({ label, months }) => {
                  const qTotal = months.reduce(
                    (sum, m) => sum + ((item.schedule as any)[`${m}_qty`] || 0),
                    0,
                  );
                  const qAmt = months.reduce(
                    (sum, m) => sum + ((item.schedule as any)[`${m}_amt`] || 0),
                    0,
                  );
                  return (
                    <div
                      key={label}
                      className="bg-gray-50 rounded-lg p-3 border border-gray-100"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">
                          {label}
                        </span>
                        <span className="text-xs text-gray-500">
                          Qty: <strong>{qTotal}</strong> | Amt:{" "}
                          <strong>
                            ₱
                            {qAmt.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </strong>
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {months.map((m) => {
                          const qty = (item.schedule as any)[`${m}_qty`] || 0;
                          const amt = (item.schedule as any)[`${m}_amt`] || 0;
                          const monthLabel =
                            MONTHS.find((mo) => mo.key === m)?.label || m;
                          return (
                            <div
                              key={m}
                              className="bg-white rounded-lg p-2 border border-gray-100"
                            >
                              <p className="text-xs font-semibold text-gray-600 mb-1">
                                {monthLabel}
                              </p>
                              <div className="space-y-1">
                                <div>
                                  <label className="text-xs text-gray-400">
                                    Qty
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={qty || ""}
                                    onChange={(e) =>
                                      updateScheduleQty(
                                        m,
                                        parseFloat(e.target.value) || 0,
                                      )
                                    }
                                    className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 mt-0.5"
                                    placeholder="0"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-400">
                                    Amount
                                  </label>
                                  <div className="w-full bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 text-xs text-gray-500 mt-0.5">
                                    ₱
                                    {amt.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// --- Main PPMPForm ---
const PPMPForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [header, setHeader] = useState({
    end_user_unit: "",
    charged_to: "STF",
    pap: "",
    date: new Date().toISOString().split("T")[0],
    revision: "0",
    year: new Date().getFullYear().toString(),
    total_estimated_budget: 0,
    prepared_by: "",
    designation: "",
  });

  const [items, setItems] = useState<PPMPItem[]>([emptyItem()]);
  const [expandedId, setExpandedId] = useState<string | null>(
    items[0]?.localId || null,
  );

  const updateHeader = (field: string, value: string) =>
    setHeader((prev) => ({ ...prev, [field]: value }));

  useEffect(() => {
    if (isEditMode) {
      setLoading(true);
      API.get(`/ppmp/${id}`)
        .then((res) => {
          const data = res.data;
          setHeader({
            end_user_unit: data.header?.end_user_unit || "",
            charged_to: data.header?.charged_to || "STF",
            pap: data.header?.pap || "",
            date: data.header?.date || new Date().toISOString().split("T")[0],
            revision: data.header?.revision || "0",
            year: data.year || new Date().getFullYear().toString(),
            total_estimated_budget: data.header?.total_estimated_budget || 0,
            prepared_by: data.header?.prepared_by || data.prepared_by || "",
            designation: data.header?.designation || data.designation || "",
          });
          const loadedItems = (data.items || []).map((item: any) => ({
            ...item,
            localId:
              item.id?.toString() ||
              Date.now().toString() + Math.random().toString(36).slice(2),
            schedule: item.schedule || emptySchedule(),
          }));
          setItems(loadedItems.length > 0 ? loadedItems : [emptyItem()]);
          setExpandedId(loadedItems[0]?.localId || null);
        })
        .catch(() => setError("Failed to load PPMP."))
        .finally(() => setLoading(false));
    }
  }, [id]);

  const handleUpdateItem = (localId: string, updated: PPMPItem) => {
    setItems((prev) =>
      prev.map((it) => (it.localId === localId ? updated : it)),
    );
  };

  // ✅ Fix: clear expandedId if the deleted item was the one expanded,
  // so numbering and expand state stay in sync after removal.
  const handleDeleteItem = (localId: string) => {
    setItems((prev) => prev.filter((it) => it.localId !== localId));
    setExpandedId((prev) => (prev === localId ? null : prev));
  };

  // ✅ New item inherits code / mode / category / unit from the last item,
  // since most items in a PPMP repeat these fields.
  const handleAddItem = () => {
    const lastItem = items[items.length - 1];
    const newItem: PPMPItem = {
      ...emptyItem(),
      code: lastItem?.code || "",
      mode_of_procurement:
        lastItem?.mode_of_procurement || "small value procurement",
      pap_category: lastItem?.pap_category || "Faculty Development",
      unit_of_issue: lastItem?.unit_of_issue || "piece",
    };
    setItems((prev) => [...prev, newItem]);
    setExpandedId(newItem.localId);
  };

  // ✅ Duplicate an existing item entirely (including schedule) —
  // useful when an item is nearly identical to another.
  const handleDuplicateItem = (item: PPMPItem) => {
    const duplicated: PPMPItem = {
      ...item,
      id: undefined,
      localId: Date.now().toString() + Math.random().toString(36).slice(2),
      general_description: item.general_description
        ? `${item.general_description} (copy)`
        : "",
    };
    setItems((prev) => [...prev, duplicated]);
    setExpandedId(duplicated.localId);
  };

  const grandTotal = items.reduce((sum, item) => sum + item.total_cost, 0);

  const handleNext = () => {
    if (!header.end_user_unit) {
      setError("End-User/Unit is required.");
      return;
    }
    if (!header.year) {
      setError("Fiscal Year is required.");
      return;
    }
    if (!header.prepared_by) {
      setError("Prepared By is required.");
      return;
    }
    if (!header.designation) {
      setError("Designation is required.");
      return;
    }
    setError("");
    setStep(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) {
      setError("Please add at least one item.");
      return;
    }

    const missingCost = items.find((it) => !it.unit_cost || it.unit_cost <= 0);
    if (missingCost) {
      setError(
        `Unit Cost (Amount) is required for "${missingCost.general_description || "an item"}".`,
      );
      return;
    }

    const missingDescription = items.find(
      (it) => !it.general_description.trim(),
    );
    if (missingDescription) {
      setError("General Description is required for every item.");
      return;
    }

    setSaving(true);
    setError("");

    const token = localStorage.getItem("token");

    const payload = {
      header: {
        end_user_unit: header.end_user_unit,
        charged_to: header.charged_to,
        pap: header.pap,
        date: header.date,
        revision: header.revision,
        prepared_by: header.prepared_by,
        designation: header.designation,
      },
      year: header.year,
      total_estimated_budget: header.total_estimated_budget,
      items: items.map(({ localId, ...rest }) => ({
        ...rest,
        schedule: rest.schedule || {},
      })),
    };

    try {
      if (isEditMode) {
        await API.put(`/ppmp/${id}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await API.post("/ppmp/", payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      navigate("/ppmp");
    } catch (err: any) {
      console.error("ERROR RESPONSE:", err.response);
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Failed to save PPMP.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <p className="text-gray-400 text-sm">Loading PPMP...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Page Banner — compact */}
      <div
        className="rounded-2xl p-4 text-white shadow-lg relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #1e3a6e 0%, #1a56a0 50%, #2471c8 100%)",
        }}
      >
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full border border-white opacity-10 pointer-events-none" />
        <div className="relative z-10">
          <p className="text-blue-200 text-xs uppercase tracking-widest font-semibold">
            Electronic Procurement Management System
          </p>
          <h1 className="text-lg font-bold mt-0.5">
            {isEditMode ? "Edit PPMP" : "Create New PPMP"}
          </h1>
          <p className="text-blue-200 text-xs mt-0.5">
            {step === 0
              ? "Step 1 — Fill in the PPMP header information."
              : "Step 2 — Add procurement items."}
          </p>
        </div>
      </div>

      {/* Step Indicator — compact */}
      <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
        <StepIndicator step={step} />
        <div className="flex justify-between text-xs text-gray-400">
          <span className={step === 0 ? "text-blue-800 font-semibold" : ""}>
            Header Info
          </span>
          <span className={step === 1 ? "text-blue-800 font-semibold" : ""}>
            Add Items
          </span>
        </div>
      </div>

      {/* ============= STEP 0: HEADER ============= */}
      {step === 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
          <h2 className="text-xs font-bold text-blue-800 uppercase tracking-widest border-b pb-2">
            PPMP Header Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="End-User / Unit" required hint="Your department">
              <input
                type="text"
                value={header.end_user_unit}
                onChange={(e) => updateHeader("end_user_unit", e.target.value)}
                className={inputClass}
                placeholder="e.g. College of Education"
                required
              />
            </Field>
            <Field label="Date">
              <input
                type="date"
                value={header.date}
                onChange={(e) => updateHeader("date", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Fiscal Year" required hint="Enter manually">
              <input
                type="text"
                value={header.year}
                onChange={(e) => updateHeader("year", e.target.value)}
                className={inputClass}
                placeholder="e.g. 2026"
                required
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Charged To (Fund Source)">
              <select
                value={header.charged_to}
                onChange={(e) => updateHeader("charged_to", e.target.value)}
                className={selectClass}
              >
                {FUND_OPTIONS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </Field>
            <Field label="Revision #">
              <input
                type="text"
                value={header.revision}
                onChange={(e) => updateHeader("revision", e.target.value)}
                className={inputClass}
                placeholder="0"
              />
            </Field>
            <Field label="Total Estimated Budget (₱)" hint="Budget ceiling">
              <input
                type="number"
                min={0}
                step="0.01"
                value={header.total_estimated_budget || ""}
                onChange={(e) =>
                  setHeader((prev) => ({
                    ...prev,
                    total_estimated_budget: parseFloat(e.target.value) || 0,
                  }))
                }
                className={inputClass}
                placeholder="0.00"
              />
            </Field>
          </div>

          <Field
            label="Projects, Activities and Programs (PAPs)"
            hint="Describe the program"
          >
            <textarea
              value={header.pap}
              onChange={(e) => updateHeader("pap", e.target.value)}
              rows={1}
              className={inputClass}
              placeholder="e.g. Faculty Development Program — Training and Seminars"
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Prepared By" required>
              <input
                type="text"
                value={header.prepared_by}
                onChange={(e) => updateHeader("prepared_by", e.target.value)}
                className={inputClass}
                placeholder="Full name"
                required
              />
            </Field>
            <Field label="Designation" required>
              <input
                type="text"
                value={header.designation}
                onChange={(e) => updateHeader("designation", e.target.value)}
                className={inputClass}
                placeholder="e.g. Dean, Department Head"
                required
              />
            </Field>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
              ⚠️ {error}
            </div>
          )}

          <div className="flex justify-between pt-1">
            <button
              type="button"
              onClick={() => navigate("/ppmp")}
              className="text-sm text-gray-500 hover:text-gray-700 font-medium px-4 py-2"
            >
              ← Cancel
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="text-sm font-bold text-white px-8 py-3 rounded-xl shadow-md hover:shadow-lg transition-all"
              style={{ background: "linear-gradient(90deg, #1e3a6e, #1a56a0)" }}
            >
              Next: Add Items →
            </button>
          </div>
        </div>
      )}

      {/* ============= STEP 1: ITEMS ============= */}
      {step === 1 && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-blue-800 uppercase tracking-widest">
                Procurement Items ({items.length})
              </h2>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1.5 text-xs font-bold text-white px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition"
                style={{
                  background: "linear-gradient(90deg, #1e3a6e, #1a56a0)",
                }}
              >
                + Add Item
              </button>
            </div>

            <p className="text-[10px] text-gray-400">
              New items automatically reuse the code, mode of procurement,
              category and unit from the last item — you usually only need to
              fill in the description and cost. Use "Duplicate" to copy an item
              entirely.
            </p>

            {[...items]
              .map((item, originalIndex) => ({ item, originalIndex }))
              .sort((a, b) => {
                if (a.item.localId === expandedId) return -1;
                if (b.item.localId === expandedId) return 1;
                return 0;
              })
              .map(({ item, originalIndex }) => (
                <ItemCard
                  key={item.localId}
                  item={item}
                  index={originalIndex}
                  isExpanded={item.localId === expandedId}
                  onToggleExpand={() =>
                    setExpandedId(
                      expandedId === item.localId ? null : item.localId,
                    )
                  }
                  onUpdate={handleUpdateItem}
                  onDelete={handleDeleteItem}
                  onDuplicate={handleDuplicateItem}
                  canDelete={items.length > 1}
                />
              ))}

            {/* Budget Comparison Card */}
            <div className="bg-white rounded-2xl px-5 py-4 shadow-sm border border-gray-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-600 uppercase tracking-wider">
                  Items Total
                </span>
                <span className="text-xl font-black text-blue-800">
                  ₱
                  {grandTotal.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>

              {header.total_estimated_budget > 0 && (
                <>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-sm font-bold text-gray-600 uppercase tracking-wider">
                      Total Estimated Budget
                    </span>
                    <span className="text-lg font-bold text-gray-700">
                      ₱
                      {header.total_estimated_budget.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  {grandTotal > header.total_estimated_budget ? (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-xl">
                      ⚠️ Items total exceeds the estimated budget by{" "}
                      <strong>
                        ₱
                        {(
                          grandTotal - header.total_estimated_budget
                        ).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </strong>
                    </div>
                  ) : (
                    <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2.5 rounded-xl">
                      ✓ Within budget — Remaining:{" "}
                      <strong>
                        ₱
                        {(
                          header.total_estimated_budget - grandTotal
                        ).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </strong>
                    </div>
                  )}
                </>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
                ⚠️ {error}
              </div>
            )}

            <div className="flex items-center justify-between pb-4">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="text-sm text-gray-500 hover:text-gray-700 font-medium px-4 py-2"
              >
                ← Back to Header
              </button>
              <button
                type="submit"
                disabled={saving}
                className="text-sm font-bold text-white px-8 py-3 rounded-xl disabled:opacity-60 shadow-md hover:shadow-lg transition-all"
                style={{
                  background: "linear-gradient(90deg, #1e3a6e, #1a56a0)",
                }}
              >
                {saving
                  ? "Saving..."
                  : isEditMode
                    ? "Update PPMP"
                    : "Save PPMP"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

export default PPMPForm;
