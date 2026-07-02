import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import type { PPMP, Office } from "../types";
import { exportPPMPToExcel } from "../services/exportPPMP";

const fmt = (n?: number) =>
  n
    ? n.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "";

const thStyle: React.CSSProperties = {
  border: "1px solid black",
  padding: "4px 6px",
  textAlign: "center",
  verticalAlign: "middle",
  fontSize: "8px",
  lineHeight: 1.25,
  fontWeight: "bold",
};
const tdStyle: React.CSSProperties = {
  border: "1px solid black",
  padding: "4px 6px",
  textAlign: "left",
  verticalAlign: "top",
  fontSize: "8px",
  whiteSpace: "pre-line",
};
const sigCellStyle: React.CSSProperties = {
  border: "none",
  padding: "0 8px",
  verticalAlign: "bottom",
  width: "33%",
  textAlign: "left",
  fontSize: "9px",
};
const sigSerifFont =
  "Book Antiqua, Palatino, Garamond, Georgia, Times New Roman, serif";

const COLUMN_HEADERS = [
  "General Description and Objective of the Project to be Procured",
  "Type of the Project to be Procured (whether Goods, Infrastructure and Consulting Services)",
  "Quantity and Size of the Project to be Procured",
  "Recommended Mode of Procurement",
  "Pre-Procurement Conference, if applicable (Yes/No)",
  "Start of Procurement Activity",
  "End of Procurement Activity",
  "Expected Delivery/ Implementation Period",
  "Source of Funds",
  "Estimated Budget / Authorized Budgetary Allocation (PhP)",
  "Attached Supporting Document/s",
  "Remarks",
];

export default function PPMPDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ppmp, setPpmp] = useState<PPMP | null>(null);
  const [office, setOffice] = useState<Office | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/ppmps/${id}`)
      .then(async (res) => {
        setPpmp(res.data);
        const officeRes = await api.get(`/offices/${res.data.office_id}`);
        setOffice(officeRes.data);
      })
      .catch(() => setError("Failed to load PPMP."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-4 border-blue-800 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  if (error)
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
        ⚠️ {error}
      </div>
    );

  if (!ppmp) return null;

  const grandTotal = ppmp.projects.reduce(
    (sum, p) => sum + p.lots.reduce((s, l) => s + (l.estimated_budget || 0), 0),
    0,
  );

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div
        className="print:hidden rounded-2xl p-6 text-white shadow-lg relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #1e3a6e 0%, #1a56a0 50%, #2471c8 100%)",
        }}
      >
        <div className="flex items-center justify-between relative z-10">
          <div>
            <p className="text-blue-200 text-xs uppercase tracking-widest font-semibold">
              PPMP Detail — FY {ppmp.year} (
              {ppmp.ppmp_type === "indicative" ? "Indicative" : "Final"})
            </p>
            <h1 className="text-xl font-bold mt-1">
              {office?.name || "Loading..."}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/ppmps")}
              className="flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl transition"
            >
              ← Back
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl transition"
            >
              🖨 Print
            </button>
            <button
              onClick={() => ppmp && office && exportPPMPToExcel(ppmp, office)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl transition"
            >
              📥 Export Excel
            </button>
            <button
              onClick={() => navigate(`/ppmps/${id}/edit`)}
              className="flex items-center gap-1.5 text-xs font-bold bg-white text-blue-900 px-3 py-2 rounded-xl shadow-md hover:shadow-lg transition"
            >
              ✏ Edit
            </button>
          </div>
        </div>
      </div>

      {/* Print area */}
      <div
        id="ppmp-print"
        className="bg-white shadow-sm border border-gray-200 rounded-2xl print:rounded-none print:shadow-none print:border-none"
        style={{
          fontFamily: "Calibri, sans-serif",
          fontSize: "9px",
          padding: "16px 20px",
        }}
      >
        {/* Letterhead */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginBottom: "6px",
          }}
        >
          <tbody>
            <tr>
              <td style={{ border: "none", textAlign: "center", padding: 0 }}>
                <img
                  src="/nemsu-logo.png"
                  alt="NEMSU Logo"
                  style={{
                    display: "block",
                    margin: "0 auto",
                    width: "55px",
                    height: "55px",
                    objectFit: "contain",
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <p
                  style={{ fontSize: "10px", margin: "0", textAlign: "center" }}
                >
                  Republic of the Philippines
                </p>
                <p
                  style={{
                    fontSize: "13px",
                    fontWeight: "bold",
                    margin: "2px 0",
                    textAlign: "center",
                  }}
                >
                  NORTH EASTERN MINDANAO STATE UNIVERSITY
                </p>
                <p
                  style={{
                    fontSize: "13px",
                    fontWeight: "bold",
                    margin: "4px 0",
                    textAlign: "center",
                  }}
                >
                  PROJECT PROCUREMENT MANAGEMENT PLAN (PPMP) NO.{" "}
                  {ppmp.ppmp_no || "___"}
                </p>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Status + meta */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "9px",
            marginBottom: "6px",
          }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  border: "none",
                  padding: "3px 6px",
                  textAlign: "center",
                }}
                colSpan={2}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: "10px",
                      height: "10px",
                      border: "1px solid #000",
                      textAlign: "center",
                      lineHeight: "9px",
                      fontSize: "8px",
                    }}
                  >
                    {ppmp.ppmp_type === "indicative" ? "✔" : ""}
                  </span>
                  INDICATIVE
                </span>
                <span style={{ display: "inline-block", width: "24px" }} />
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: "10px",
                      height: "10px",
                      border: "1px solid #000",
                      textAlign: "center",
                      lineHeight: "9px",
                      fontSize: "8px",
                    }}
                  >
                    {ppmp.ppmp_type === "final" ? "✔" : ""}
                  </span>
                  FINAL
                </span>
              </td>
            </tr>
            <tr>
              <td style={{ border: "none", padding: "1px 6px" }} colSpan={2}>
                <strong style={{ display: "inline-block", width: "220px" }}>
                  Fiscal Year:
                </strong>
                {ppmp.year}
              </td>
            </tr>
            <tr>
              <td style={{ border: "none", padding: "1px 6px" }} colSpan={2}>
                <strong style={{ display: "inline-block", width: "220px" }}>
                  End-User or Implementing Unit:
                </strong>
                {office?.name || "___"}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Main procurement table */}
        <div style={{ overflowX: "auto" }}>
          <table
            className="ppmp-schedule-table"
            style={{
              width: "100%",
              borderCollapse: "collapse",
              tableLayout: "auto",
            }}
          >
            <colgroup>
              <col style={{ width: "16%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "7%" }} />
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
                <th style={thStyle} rowSpan={2}>
                  ATTACHED SUPPORTING DOCUMENTS
                </th>
                <th style={thStyle} rowSpan={2}>
                  REMARKS
                </th>
              </tr>
              <tr>
                {COLUMN_HEADERS.slice(0, 10).map((h, i) => (
                  <th key={i} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
              <tr>
                {COLUMN_HEADERS.map((_, i) => (
                  <th
                    key={i}
                    style={{ ...thStyle, backgroundColor: "#f2f2f2" }}
                  >
                    Column {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ppmp.projects.map((project, pIndex) => {
                const lots =
                  project.lots.length > 0
                    ? project.lots
                    : [
                        {
                          id: 0,
                          lot_no: "",
                          quantity_size: "",
                          estimated_budget: 0,
                        },
                      ];
                return lots.map((lot, lIndex) => (
                  <tr
                    key={`${project.id}-${lIndex}`}
                    style={{
                      backgroundColor: pIndex % 2 === 0 ? "#fff" : "#f9fafb",
                    }}
                  >
                    {lIndex === 0 && (
                      <td
                        style={{ ...tdStyle, fontWeight: 500 }}
                        rowSpan={lots.length}
                      >
                        {project.description}
                      </td>
                    )}
                    <td style={tdStyle}>{project.project_type}</td>
                    <td style={tdStyle}>
                      {lots.length > 1 && <strong>{lot.lot_no}: </strong>}
                      {lot.quantity_size}
                    </td>
                    {lIndex === 0 && (
                      <td style={tdStyle} rowSpan={lots.length}>
                        {project.procurement_mode}
                      </td>
                    )}
                    {lIndex === 0 && (
                      <td
                        style={{ ...tdStyle, textAlign: "center" }}
                        rowSpan={lots.length}
                      >
                        {project.pre_proc_conference}
                      </td>
                    )}
                    {lIndex === 0 && (
                      <td style={tdStyle} rowSpan={lots.length}>
                        {project.start_activity}
                      </td>
                    )}
                    {lIndex === 0 && (
                      <td style={tdStyle} rowSpan={lots.length}>
                        {project.end_activity}
                      </td>
                    )}
                    {lIndex === 0 && (
                      <td style={tdStyle} rowSpan={lots.length}>
                        {project.delivery_period}
                      </td>
                    )}
                    {lIndex === 0 && (
                      <td style={tdStyle} rowSpan={lots.length}>
                        {project.source_of_funds}
                      </td>
                    )}
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: "right",
                        fontWeight: "bold",
                      }}
                    >
                      {lot.estimated_budget
                        ? `₱${fmt(lot.estimated_budget)}`
                        : ""}
                    </td>
                    {lIndex === 0 && (
                      <td style={tdStyle} rowSpan={lots.length}>
                        {project.supporting_docs}
                      </td>
                    )}
                    {lIndex === 0 && (
                      <td style={tdStyle} rowSpan={lots.length}>
                        {project.remarks}
                      </td>
                    )}
                  </tr>
                ));
              })}
              <tr style={{ backgroundColor: "#fffff", fontWeight: "bold" }}>
                <td style={{ ...tdStyle, border: "None" }} />
                <td style={{ ...tdStyle, border: "None" }} />
                <td style={{ ...tdStyle, border: "None" }} />
                <td style={{ ...tdStyle, border: "None" }} />
                <td style={{ ...tdStyle, border: "None" }} />
                <td style={{ ...tdStyle, border: "None" }} />
                <td style={{ ...tdStyle, border: "None" }} />
                <td
                  colSpan={2}
                  style={{
                    ...tdStyle,
                    textAlign: "right",
                    borderColor: "#000",
                  }}
                >
                  TOTAL BUDGET:
                </td>
                <td
                  style={{
                    ...tdStyle,
                    textAlign: "right",
                    borderColor: "#000",
                  }}
                >
                  ₱{fmt(grandTotal)}
                </td>
                <td style={{ ...tdStyle, border: "None" }} />
                <td style={{ ...tdStyle, border: "None" }} />
              </tr>
            </tbody>
          </table>
        </div>

        {/* Signature block */}
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
              <td
                style={{
                  ...sigCellStyle,
                  fontWeight: "bold",
                  fontFamily: sigSerifFont,
                }}
              >
                Prepared by:
              </td>
              <td
                style={{
                  ...sigCellStyle,
                  fontWeight: "bold",
                  fontFamily: sigSerifFont,
                }}
              >
                Submitted by:
              </td>
              <td
                style={{
                  ...sigCellStyle,
                  fontWeight: "bold",
                  fontFamily: sigSerifFont,
                }}
              >
                Approved by:
              </td>
            </tr>
            <tr>
              <td style={{ ...sigCellStyle, height: "28px" }} />
              <td style={{ ...sigCellStyle, height: "28px" }} />
              <td style={{ ...sigCellStyle, height: "28px" }} />
            </tr>
            <tr>
              <td
                style={{
                  ...sigCellStyle,
                  fontWeight: "bold",
                  textDecoration: "underline",
                  fontFamily: sigSerifFont,
                }}
              >
                ________________________________
              </td>
              <td
                style={{
                  ...sigCellStyle,
                  fontWeight: "bold",
                  textDecoration: "underline",
                  fontFamily: sigSerifFont,
                }}
              >
                ________________________________
              </td>
              <td
                style={{
                  ...sigCellStyle,
                  fontWeight: "bold",
                  textDecoration: "underline",
                  fontFamily: sigSerifFont,
                }}
              >
                ________________________________
              </td>
            </tr>
            <tr>
              <td
                style={{
                  ...sigCellStyle,
                  fontSize: "8px",
                  paddingTop: "2px",
                  fontFamily: sigSerifFont,
                }}
              >
                Signature over Printed Name
              </td>
              <td
                style={{
                  ...sigCellStyle,
                  fontSize: "8px",
                  paddingTop: "2px",
                  fontFamily: sigSerifFont,
                }}
              >
                Signature over Printed Name
              </td>
              <td
                style={{
                  ...sigCellStyle,
                  fontSize: "8px",
                  paddingTop: "2px",
                  fontFamily: sigSerifFont,
                }}
              >
                Signature over Printed Name
              </td>
            </tr>
            <tr>
              <td
                style={{
                  ...sigCellStyle,
                  fontSize: "8px",
                  paddingTop: "2px",
                  fontFamily: sigSerifFont,
                }}
              >
                Position/Designation
              </td>
              <td
                style={{
                  ...sigCellStyle,
                  fontSize: "8px",
                  paddingTop: "2px",
                  fontFamily: sigSerifFont,
                }}
              >
                Position/Designation
              </td>
              <td
                style={{
                  ...sigCellStyle,
                  fontSize: "8px",
                  paddingTop: "2px",
                  fontFamily: sigSerifFont,
                }}
              >
                Position/Designation
              </td>
            </tr>
            <tr>
              <td
                style={{
                  ...sigCellStyle,
                  fontSize: "8px",
                  paddingTop: "8px",
                  fontFamily: sigSerifFont,
                }}
              >
                Date: _________________
              </td>
              <td
                style={{
                  ...sigCellStyle,
                  fontSize: "8px",
                  paddingTop: "8px",
                  fontFamily: sigSerifFont,
                }}
              >
                Date: _________________
              </td>
              <td
                style={{
                  ...sigCellStyle,
                  fontSize: "8px",
                  paddingTop: "8px",
                  fontFamily: sigSerifFont,
                }}
              >
                Date: _________________
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <style>{`
  @media print {
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body * { visibility: hidden; }
    #ppmp-print, #ppmp-print * { visibility: visible; }
    #ppmp-print img { 
      visibility: visible !important;
      display: block !important;
    }
    #ppmp-print {
      position: fixed;
      top: 0; left: 0;
      width: 100%;
      padding: 8mm 10mm;
      font-size: 7px;
    }
    .ppmp-schedule-table th,
    .ppmp-schedule-table td {
      padding: 2px 4px !important;
      font-size: 7px !important;
      line-height: 1.2 !important;
    }
    @page {
      size: legal landscape;
      margin: 6mm 8mm;
    }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
  }
`}</style>
    </div>
  );
}
