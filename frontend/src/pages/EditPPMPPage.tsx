import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import type { PPMP } from "../types";

const PROJECT_TYPES = ["Goods", "Infrastructure", "Consulting Services"];
const PROCUREMENT_MODES = [
  "Competitive Public Bidding",
  "Small Value Procurement (SVP)",
  "Direct Contracting",
  "Direct Acquisition",
  "Agency-to-Agency",
  "Negotiated Procurement",
  "Shopping",
  "N/A (By Administration)",
];
const FUND_SOURCES = [
  "GoP",
  "GAA - Current Appropriation",
  "GAA - Continuing Appropriation",
  "Internally Generated Income",
  "Special Purpose Fund",
  "Trust Fund",
];
const SUPPORTING_DOCS = [
  "Technical Specifications",
  "Approved Project Proposal",
  "Terms of Reference",
  "Scope of Work",
  "Detailed Program of Activity",
  "Program of Works",
  "GSIS billing statement",
  "Engineering Plan",
  "Feasibility Study",
];

interface LotForm {
  id?: number;
  lot_no: string;
  quantity_size: string;
  estimated_budget: string;
}

interface ProjectForm {
  id?: number;
  description: string;
  project_type: string;
  procurement_mode: string;
  pre_proc_conference: string;
  start_activity: string;
  end_activity: string;
  delivery_period: string;
  source_of_funds: string;
  supporting_docs: string[];
  remarks: string;
  lots: LotForm[];
}

const emptyLot = (): LotForm => ({
  lot_no: "Lot 1",
  quantity_size: "",
  estimated_budget: "",
});

const emptyProject = (): ProjectForm => ({
  description: "",
  project_type: "Goods",
  procurement_mode: "Direct Acquisition",
  pre_proc_conference: "No",
  start_activity: "",
  end_activity: "",
  delivery_period: "",
  source_of_funds: "GoP",
  supporting_docs: ["Technical Specifications", "Approved Project Proposal"],
  remarks: "",
  lots: [emptyLot()],
});

export default function EditPPMPPage() {
  const { id } = useParams();
  const { dbUser } = useAuth();
  const navigate = useNavigate();

  const [year, setYear] = useState(new Date().getFullYear() + 1);
  const [ppmpNo, setPpmpNo] = useState("1");
  const [ppmpType, setPpmpType] = useState("indicative");
  const [projects, setProjects] = useState<ProjectForm[]>([emptyProject()]);
  const [activeProject, setActiveProject] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load existing PPMP data
  useEffect(() => {
    api
      .get(`/ppmps/${id}`)
      .then((res) => {
        const ppmp: PPMP = res.data;
        setYear(ppmp.year);
        setPpmpNo(ppmp.ppmp_no || "1");
        setPpmpType(ppmp.ppmp_type);
        setProjects(
          ppmp.projects.map((p) => ({
            id: p.id,
            description: p.description,
            project_type: p.project_type,
            procurement_mode: p.procurement_mode || "Direct Acquisition",
            pre_proc_conference: p.pre_proc_conference,
            start_activity: p.start_activity || "",
            end_activity: p.end_activity || "",
            delivery_period: p.delivery_period || "",
            source_of_funds: p.source_of_funds,
            supporting_docs: p.supporting_docs
              ? p.supporting_docs.split("; ").filter(Boolean)
              : [],
            remarks: p.remarks || "",
            lots: p.lots.map((l) => ({
              id: l.id,
              lot_no: l.lot_no,
              quantity_size: l.quantity_size,
              estimated_budget: String(l.estimated_budget),
            })),
          })),
        );
      })
      .catch(() => setError("Failed to load PPMP."))
      .finally(() => setLoading(false));
  }, [id]);

  const updateProject = (
    index: number,
    field: keyof ProjectForm,
    value: any,
  ) => {
    setProjects((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
    );
  };

  const updateLot = (
    pIndex: number,
    lIndex: number,
    field: keyof LotForm,
    value: string,
  ) => {
    setProjects((prev) =>
      prev.map((p, i) => {
        if (i !== pIndex) return p;
        return {
          ...p,
          lots: p.lots.map((l, j) =>
            j === lIndex ? { ...l, [field]: value } : l,
          ),
        };
      }),
    );
  };

  const addLot = (pIndex: number) => {
    setProjects((prev) =>
      prev.map((p, i) => {
        if (i !== pIndex) return p;
        return {
          ...p,
          lots: [
            ...p.lots,
            { ...emptyLot(), lot_no: `Lot ${p.lots.length + 1}` },
          ],
        };
      }),
    );
  };

  const removeLot = (pIndex: number, lIndex: number) => {
    setProjects((prev) =>
      prev.map((p, i) => {
        if (i !== pIndex) return p;
        return { ...p, lots: p.lots.filter((_, j) => j !== lIndex) };
      }),
    );
  };

  const addProject = () => {
    setProjects((prev) => [...prev, emptyProject()]);
    setActiveProject(projects.length);
  };

  const removeProject = (index: number) => {
    setProjects((prev) => prev.filter((_, i) => i !== index));
    setActiveProject(Math.max(0, index - 1));
  };

  const toggleDoc = (pIndex: number, doc: string) => {
    const current = projects[pIndex].supporting_docs;
    const updated = current.includes(doc)
      ? current.filter((d) => d !== doc)
      : [...current, doc];
    updateProject(pIndex, "supporting_docs", updated);
  };

  const projectTotal = (p: ProjectForm) =>
    p.lots.reduce((sum, l) => sum + (parseFloat(l.estimated_budget) || 0), 0);

  const grandTotal = projects.reduce((sum, p) => sum + projectTotal(p), 0);

  const handleSubmit = async () => {
    if (!dbUser?.office_id) {
      setError("Your account is not assigned to an office.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      // Delete old PPMP and recreate with updated data
      await api.delete(`/ppmps/${id}`);
      const payload = {
        year,
        ppmp_no: ppmpNo,
        ppmp_type: ppmpType,
        projects: projects.map((p, i) => ({
          description: p.description,
          project_type: p.project_type,
          procurement_mode: p.procurement_mode,
          pre_proc_conference: p.pre_proc_conference,
          start_activity: p.start_activity,
          end_activity: p.end_activity,
          delivery_period: p.delivery_period,
          source_of_funds: p.source_of_funds,
          supporting_docs: p.supporting_docs.join("; "),
          remarks: p.remarks,
          order_no: i + 1,
          lots: p.lots.map((l) => ({
            lot_no: l.lot_no,
            quantity_size: l.quantity_size,
            estimated_budget: parseFloat(l.estimated_budget) || 0,
          })),
        })),
      };
      const res = await api.post("/ppmps/", payload, {
        params: { office_id: dbUser.office_id, created_by: dbUser.id },
      });
      navigate(`/ppmps/${res.data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to save PPMP.");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    );

  const proj = projects[activeProject];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-blue-900">Edit PPMP</h1>
          <p className="text-gray-500 text-sm mt-1">
            Update your procurement projects
          </p>
        </div>
        <button
          onClick={() => navigate(`/ppmps/${id}`)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Cancel
        </button>
      </div>

      {/* Header fields */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="text-sm font-semibold text-blue-900 mb-4">
          PPMP Header
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Fiscal Year
            </label>
            <input
              type="number"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">PPMP No.</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={ppmpNo}
              onChange={(e) => setPpmpNo(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Type</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={ppmpType}
              onChange={(e) => setPpmpType(e.target.value)}
            >
              <option value="indicative">Indicative</option>
              <option value="final">Final</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Project sidebar */}
        <div className="w-52 shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Projects
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {projects.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setActiveProject(i)}
                  className={`w-full text-left px-3 py-3 text-xs transition ${
                    activeProject === i
                      ? "bg-blue-50 text-blue-800 font-medium"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <p className="font-medium">Project {i + 1}</p>
                  <p className="text-gray-400 truncate mt-0.5">
                    {p.description || "No description"}
                  </p>
                  <p className="text-blue-600 mt-0.5">
                    ₱
                    {projectTotal(p).toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </button>
              ))}
            </div>
            <div className="p-2 border-t border-gray-100">
              <button
                onClick={addProject}
                className="w-full text-xs text-blue-700 hover:text-blue-900 py-1.5 rounded hover:bg-blue-50 transition"
              >
                + Add Project
              </button>
            </div>
          </div>

          <div className="bg-blue-50 rounded-xl border border-blue-200 p-3 mt-3">
            <p className="text-xs text-blue-600 font-medium">Grand Total</p>
            <p className="text-sm font-semibold text-blue-900 mt-1">
              ₱
              {grandTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Project form */}
        <div className="flex-1 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-semibold text-blue-900">
                Project {activeProject + 1}
              </h2>
              {projects.length > 1 && (
                <button
                  onClick={() => removeProject(activeProject)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove project
                </button>
              )}
            </div>

            <div className="mb-4">
              <label className="text-xs text-gray-500 mb-1 block">
                Description & Objective <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                value={proj.description}
                onChange={(e) =>
                  updateProject(activeProject, "description", e.target.value)
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Type of Project
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={proj.project_type}
                  onChange={(e) =>
                    updateProject(activeProject, "project_type", e.target.value)
                  }
                >
                  {PROJECT_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Mode of Procurement
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={proj.procurement_mode}
                  onChange={(e) =>
                    updateProject(
                      activeProject,
                      "procurement_mode",
                      e.target.value,
                    )
                  }
                >
                  {PROCUREMENT_MODES.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Pre-Proc Conference
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={proj.pre_proc_conference}
                  onChange={(e) =>
                    updateProject(
                      activeProject,
                      "pre_proc_conference",
                      e.target.value,
                    )
                  }
                >
                  <option>No</option>
                  <option>Yes</option>
                  <option>N/A</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Start of Activity
                </label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={proj.start_activity}
                  onChange={(e) =>
                    updateProject(
                      activeProject,
                      "start_activity",
                      e.target.value,
                    )
                  }
                  placeholder="e.g. Jan. 2027"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  End of Activity
                </label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={proj.end_activity}
                  onChange={(e) =>
                    updateProject(activeProject, "end_activity", e.target.value)
                  }
                  placeholder="e.g. Jan. 2027"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Delivery Period
                </label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={proj.delivery_period}
                  onChange={(e) =>
                    updateProject(
                      activeProject,
                      "delivery_period",
                      e.target.value,
                    )
                  }
                  placeholder="e.g. Jan. - Dec. 2027"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs text-gray-500 mb-1 block">
                Source of Funds
              </label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={proj.source_of_funds}
                onChange={(e) =>
                  updateProject(
                    activeProject,
                    "source_of_funds",
                    e.target.value,
                  )
                }
              >
                {FUND_SOURCES.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="text-xs text-gray-500 mb-2 block">
                Supporting Documents
              </label>
              <div className="flex flex-wrap gap-2">
                {SUPPORTING_DOCS.map((doc) => (
                  <button
                    key={doc}
                    type="button"
                    onClick={() => toggleDoc(activeProject, doc)}
                    className={`text-xs px-2.5 py-1.5 rounded-full border transition ${
                      proj.supporting_docs.includes(doc)
                        ? "bg-blue-700 text-white border-blue-700"
                        : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                    }`}
                  >
                    {doc}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                Remarks (optional)
              </label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={proj.remarks}
                onChange={(e) =>
                  updateProject(activeProject, "remarks", e.target.value)
                }
              />
            </div>
          </div>

          {/* Lots */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-semibold text-blue-900">
                Lots / Quantity & Size
              </h2>
              <button
                onClick={() => addLot(activeProject)}
                className="text-xs text-blue-700 hover:text-blue-900 border border-blue-200 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition"
              >
                + Add Lot
              </button>
            </div>
            <div className="space-y-4">
              {proj.lots.map((lot, lIndex) => (
                <div
                  key={lIndex}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex justify-between items-center mb-3">
                    <input
                      className="text-sm font-medium text-blue-800 bg-transparent border-b border-dashed border-blue-300 focus:outline-none w-24"
                      value={lot.lot_no}
                      onChange={(e) =>
                        updateLot(
                          activeProject,
                          lIndex,
                          "lot_no",
                          e.target.value,
                        )
                      }
                    />
                    {proj.lots.length > 1 && (
                      <button
                        onClick={() => removeLot(activeProject, lIndex)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="mb-3">
                    <label className="text-xs text-gray-500 mb-1 block">
                      Quantity & Size Description
                    </label>
                    <textarea
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      value={lot.quantity_size}
                      onChange={(e) =>
                        updateLot(
                          activeProject,
                          lIndex,
                          "quantity_size",
                          e.target.value,
                        )
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Estimated Budget (₱)
                    </label>
                    <input
                      type="number"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={lot.estimated_budget}
                      onChange={(e) =>
                        updateLot(
                          activeProject,
                          lIndex,
                          "estimated_budget",
                          e.target.value,
                        )
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-right text-sm text-gray-500">
              Project total:{" "}
              <span className="font-semibold text-blue-900">
                ₱
                {projectTotal(proj).toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={() => navigate(`/ppmps/${id}`)}
          className="px-5 py-2 text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="px-5 py-2 bg-blue-700 text-white text-sm rounded-lg hover:bg-blue-800 disabled:opacity-50 transition"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
