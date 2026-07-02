import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { exportAPPToExcel } from "../services/exportAPP";

interface APPRow {
  project_title: string;
  end_user: string;
  general_description: string;
  procurement_mode: string;
  early_procurement: string;
  bid_evaluation: string;
  start_activity: string;
  end_activity: string;
  source_of_funds: string;
  estimated_budget: number;
  procurement_strategy: string;
  remarks: string;
}

interface APPData {
  ppmp_id: number;
  ppmp_no: string;
  year: number;
  office_name: string;
  total_rows: number;
  grand_total: number;
  rows: APPRow[];
}

interface PPMPOption {
  id: number;
  year: number;
  ppmp_no: string | null;
  ppmp_type: string;
  office_id: number;
}

interface Office {
  id: number;
  name: string;
  code: string;
}

const fmt = (n: number) =>
  n.toLocaleString("en-PH", { minimumFractionDigits: 2 });

const thStyle: React.CSSProperties = {
  border: "1px solid black",
  padding: "4px 6px",
  textAlign: "center",
  verticalAlign: "middle",
  fontSize: "8px",
  lineHeight: 1.25,
  fontWeight: "bold",
  backgroundColor: "#D9E1F2",
};
const tdStyle: React.CSSProperties = {
  border: "1px solid black",
  padding: "4px 6px",
  textAlign: "left",
  verticalAlign: "top",
  fontSize: "8px",
  whiteSpace: "pre-line",
};

export default function APPPage() {
  const { dbUser } = useAuth();
  const navigate = useNavigate();
  const isAdmin = dbUser?.role === "admin";

  const [allPpmps, setAllPpmps] = useState<PPMPOption[]>([]);
  const [filteredPpmps, setFilteredPpmps] = useState<PPMPOption[]>([]);
  const [selectedPpmpId, setSelectedPpmpId] = useState<number | null>(null);
  const [appData, setAppData] = useState<APPData | null>(null);
  const [loading, setLoading] = useState(false);
  const [appType, setAppType] = useState("indicative");

  // Admin filters
  const [offices, setOffices] = useState<Office[]>([]);
  const [filterOfficeId, setFilterOfficeId] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>("");

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 1 + i);

  // Fetch offices for admin filter
  useEffect(() => {
    if (isAdmin) {
      api.get("/offices/").then((res) => setOffices(res.data));
    }
  }, [isAdmin]);

  // Fetch PPMP list
  useEffect(() => {
    if (!dbUser?.id) return;
    const params: Record<string, any> = {};
    if (isAdmin) {
      if (filterOfficeId) params.office_id = Number(filterOfficeId);
      if (filterYear) params.year = Number(filterYear);
    } else {
      params.created_by = dbUser.id;
    }

    api.get("/ppmps/", { params }).then((res) => {
      setAllPpmps(res.data);
      setFilteredPpmps(res.data);
      if (res.data.length > 0) setSelectedPpmpId(res.data[0].id);
      else setSelectedPpmpId(null);
    });
  }, [dbUser, filterOfficeId, filterYear]);

  // Fetch APP data when selected PPMP changes
  useEffect(() => {
    if (!selectedPpmpId) {
      setAppData(null);
      return;
    }
    setLoading(true);
    api
      .get(`/app/generate/from-ppmp/${selectedPpmpId}`)
      .then((res) => setAppData(res.data))
      .catch(() => setAppData(null))
      .finally(() => setLoading(false));
  }, [selectedPpmpId]);

  return (
    <div>
      {/* Action bar */}
      <div
        className="print:hidden rounded-2xl p-6 text-white shadow-lg mb-6"
        style={{
          background:
            "linear-gradient(135deg, #1e3a6e 0%, #1a56a0 50%, #2471c8 100%)",
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-blue-200 text-xs uppercase tracking-widest font-semibold">
              Annual Procurement Plan
            </p>
            <h1 className="text-xl font-bold mt-1">
              {isAdmin ? "View APP by Office" : "Generate APP from PPMP"}
            </h1>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Admin office filter */}
            {isAdmin && (
              <>
                <select
                  className="text-sm bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 focus:outline-none"
                  value={filterOfficeId}
                  onChange={(e) => setFilterOfficeId(e.target.value)}
                >
                  <option value="">All Offices</option>
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.code})
                    </option>
                  ))}
                </select>
                <select
                  className="text-sm bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 focus:outline-none"
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                >
                  <option value="">All Years</option>
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      FY {y}
                    </option>
                  ))}
                </select>
              </>
            )}

            {/* PPMP selector */}
            <select
              className="text-sm bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 focus:outline-none"
              value={selectedPpmpId || ""}
              onChange={(e) => setSelectedPpmpId(Number(e.target.value))}
            >
              {filteredPpmps.length === 0 ? (
                <option>No PPMPs available</option>
              ) : (
                filteredPpmps.map((p) => (
                  <option key={p.id} value={p.id}>
                    FY {p.year} — PPMP No. {p.ppmp_no} ({p.ppmp_type})
                  </option>
                ))
              )}
            </select>

            <select
              className="text-sm bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 focus:outline-none"
              value={appType}
              onChange={(e) => setAppType(e.target.value)}
            >
              <option value="indicative">Indicative</option>
              <option value="final">Final</option>
            </select>

            {appData && (
              <>
                <button
                  onClick={() => window.print()}
                  className="text-xs font-semibold bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl transition"
                >
                  🖨 Print
                </button>
                <button
                  onClick={() => appData && exportAPPToExcel(appData, appType)}
                  className="text-xs font-bold bg-white text-blue-900 px-3 py-2 rounded-xl shadow-md hover:shadow-lg transition"
                >
                  📥 Export Excel
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {filteredPpmps.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <p className="text-gray-400 text-sm">
            {isAdmin
              ? "No PPMPs found for the selected filters."
              : "You need to create a PPMP first before generating an APP."}
          </p>
          {!isAdmin && (
            <button
              onClick={() => navigate("/ppmps/create")}
              className="mt-4 bg-blue-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-800 transition"
            >
              Create your first PPMP
            </button>
          )}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-blue-800 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !appData ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <p className="text-gray-400 text-sm">Failed to generate APP data.</p>
        </div>
      ) : (
        <div
          id="app-print"
          className="bg-white shadow-sm border border-gray-200 rounded-2xl print:rounded-none print:shadow-none print:border-none"
          style={{ fontFamily: "Calibri, sans-serif", padding: "16px 20px" }}
        >
          <div style={{ textAlign: "center", marginBottom: "8px" }}>
            <p style={{ fontSize: "10px", margin: 0 }}>
              Republic of the Philippines
            </p>
            <p
              style={{ fontSize: "13px", fontWeight: "bold", margin: "2px 0" }}
            >
              NORTH EASTERN MINDANAO STATE UNIVERSITY
            </p>
            <p
              style={{ fontSize: "13px", fontWeight: "bold", margin: "4px 0" }}
            >
              ANNUAL PROCUREMENT PLAN FOR FY {appData.year}
            </p>
            <div style={{ fontSize: "10px", margin: "4px 0" }}>
              <span style={{ marginRight: "16px" }}>
                <span
                  style={{
                    display: "inline-block",
                    width: "10px",
                    height: "10px",
                    border: "1px solid #000",
                    textAlign: "center",
                    fontSize: "8px",
                    lineHeight: "10px",
                  }}
                >
                  {appType === "indicative" ? "✔" : ""}
                </span>{" "}
                INDICATIVE
              </span>
              <span>
                <span
                  style={{
                    display: "inline-block",
                    width: "10px",
                    height: "10px",
                    border: "1px solid #000",
                    textAlign: "center",
                    fontSize: "8px",
                    lineHeight: "10px",
                  }}
                >
                  {appType === "final" ? "✔" : ""}
                </span>{" "}
                FINAL
              </span>
            </div>
            <p style={{ fontSize: "10px", margin: "4px 0" }}>
              End-User or Implementing Unit:{" "}
              <strong>{appData.office_name}</strong>
            </p>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                tableLayout: "auto",
              }}
            >
              <colgroup>
                <col style={{ width: "18%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "5%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "6%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={thStyle} colSpan={4}>
                    PROCUREMENT PROJECT DETAILS
                  </th>
                  <th style={thStyle} colSpan={4}>
                    PROJECTED TIMELINE (MM/YYYY)
                  </th>
                  <th style={thStyle} colSpan={2}>
                    FUNDING DETAILS
                  </th>
                  <th style={thStyle}>PROCUREMENT STRATEGY OR TOOLS</th>
                  <th style={thStyle}>REMARKS</th>
                </tr>
                <tr>
                  {[
                    "Project Title",
                    "End-User or Implementing Unit",
                    "General Description of the Project",
                    "Mode of Procurement",
                    "Early Procurement Activity? (Yes/No)",
                    "Criteria for Bid Evaluation",
                    "Start of Procurement Activity",
                    "End of Procurement Activity",
                    "Source of Fund",
                    "Estimated Budget / ABC (PhP)",
                    "Procurement Strategy or Tools",
                    "Remarks",
                  ].map((h, i) => (
                    <th key={i} style={thStyle}>
                      {h}
                    </th>
                  ))}
                </tr>
                <tr>
                  {Array.from({ length: 12 }, (_, i) => (
                    <th key={i} style={thStyle}>
                      Column {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {appData.rows.map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      backgroundColor: i % 2 === 0 ? "#fff" : "#f9fafb",
                    }}
                  >
                    <td style={tdStyle}>{row.project_title}</td>
                    <td style={tdStyle}>{row.end_user}</td>
                    <td style={tdStyle}>{row.general_description}</td>
                    <td style={tdStyle}>{row.procurement_mode}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      {row.early_procurement}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      {row.bid_evaluation}
                    </td>
                    <td style={tdStyle}>{row.start_activity}</td>
                    <td style={tdStyle}>{row.end_activity}</td>
                    <td style={tdStyle}>{row.source_of_funds}</td>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: "right",
                        fontWeight: "bold",
                      }}
                    >
                      {row.estimated_budget
                        ? `₱${fmt(row.estimated_budget)}`
                        : ""}
                    </td>
                    <td style={tdStyle}>{row.procurement_strategy}</td>
                    <td style={tdStyle}>{row.remarks}</td>
                  </tr>
                ))}
                <tr style={{ backgroundColor: "#EC9706", fontWeight: "bold" }}>
                  <td
                    colSpan={9}
                    style={{
                      ...tdStyle,
                      textAlign: "right",
                      borderColor: "#000",
                    }}
                  >
                    Total Amount of Estimated Budget:
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: "right",
                      borderColor: "#000",
                    }}
                  >
                    ₱{fmt(appData.grand_total)}
                  </td>
                  <td style={{ ...tdStyle, borderColor: "#000" }} />
                  <td style={{ ...tdStyle, borderColor: "#000" }} />
                </tr>
              </tbody>
            </table>
          </div>

          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: "24px",
              fontSize: "9px",
            }}
          >
            <tbody>
              <tr>
                {["Prepared by:", "Recommended by:", "Approved by:"].map(
                  (label, i) => (
                    <td
                      key={i}
                      style={{
                        border: "none",
                        padding: "0 8px",
                        width: "33%",
                        fontWeight: "bold",
                      }}
                    >
                      {label}
                    </td>
                  ),
                )}
              </tr>
              <tr>
                <td colSpan={3} style={{ height: "28px", border: "none" }} />
              </tr>
              <tr>
                {[
                  "BAC Secretariat",
                  "BAC Chairperson",
                  "Head of the Procuring Entity",
                ].map((role, i) => (
                  <td
                    key={i}
                    style={{
                      border: "none",
                      padding: "0 8px",
                      fontSize: "8px",
                    }}
                  >
                    <div
                      style={{
                        borderTop: "1px solid black",
                        paddingTop: "4px",
                      }}
                    >
                      ________________________________
                      <br />
                      Signature over Printed Name
                      <br />
                      Position/Designation
                      <br />
                      {role}
                    </div>
                    <div style={{ marginTop: "8px" }}>
                      Date: _________________
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body * { visibility: hidden; }
          #app-print, #app-print * { visibility: visible; }
          #app-print { position: fixed; top: 0; left: 0; width: 100%; padding: 8mm 10mm; font-size: 7px; }
          @page { size: legal landscape; margin: 6mm 8mm; }
        }
      `}</style>
    </div>
  );
}
