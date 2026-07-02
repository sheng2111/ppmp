import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import type { Office } from "../types";
import { exportPRToExcel } from "../services/exportPR";

interface PRItem {
  id: number;
  lot_label: string | null;
  stock_property_no: string | null;
  unit: string | null;
  item_description: string;
  quantity: number;
  unit_price: number;
  total_cost: number;
}

interface PR {
  id: number;
  office_id: number;
  pr_number: string | null;
  fund_cluster: string | null;
  responsibility_center_code: string | null;
  purpose: string | null;
  requested_date: string | null;
  requested_by_name: string | null;
  requested_by_designation: string | null;
  approved_by_name: string | null;
  approved_by_designation: string | null;
  status: string;
  items: PRItem[];
}

const fmt = (n: number) =>
  n.toLocaleString("en-PH", { minimumFractionDigits: 2 });

const tdStyle: React.CSSProperties = {
  border: "1px solid black",
  padding: "3px 6px",
  fontSize: "9px",
  verticalAlign: "top",
};

export default function PRDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pr, setPr] = useState<PR | null>(null);
  const [office, setOffice] = useState<Office | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/prs/${id}`)
      .then(async (res) => {
        setPr(res.data);
        const officeRes = await api.get(`/offices/${res.data.office_id}`);
        setOffice(officeRes.data);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-4 border-blue-800 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  if (!pr) return <p className="text-gray-400">PR not found.</p>;

  const grandTotal = pr.items.reduce((sum, i) => {
    if (!i.lot_label || i.unit) return sum + i.quantity * i.unit_price;
    return sum;
  }, 0);

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div
        className="print:hidden rounded-2xl p-6 text-white shadow-lg"
        style={{
          background:
            "linear-gradient(135deg, #1e3a6e 0%, #1a56a0 50%, #2471c8 100%)",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-xs uppercase tracking-widest font-semibold">
              Purchase Request
            </p>
            <h1 className="text-xl font-bold mt-1">
              {pr.pr_number || `PR #${pr.id}`}
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate("/prs")}
              className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl transition"
            >
              ← Back
            </button>
            <button
              onClick={() => window.print()}
              className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl transition"
            >
              🖨 Print
            </button>
            <button
              onClick={() => pr && office && exportPRToExcel(pr, office)}
              className="text-xs font-bold bg-white text-blue-900 px-3 py-2 rounded-xl shadow-md hover:shadow-lg transition"
            >
              📥 Export Excel
            </button>
          </div>
        </div>
      </div>

      {/* Print area */}
      <div
        id="pr-print"
        className="bg-white shadow-sm border border-gray-200 rounded-2xl print:rounded-none print:shadow-none print:border-none"
        style={{ fontFamily: "Calibri, sans-serif", padding: "16px 20px" }}
      >
        {/* Header */}
        <div
          style={{ textAlign: "right", fontSize: "8px", marginBottom: "4px" }}
        >
          Appendix 60
        </div>
        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          <p style={{ fontSize: "14px", fontWeight: "bold", margin: 0 }}>
            PURCHASE REQUEST
          </p>
        </div>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "9px",
            marginBottom: "4px",
          }}
        >
          <tbody>
            <tr>
              <td style={{ border: "none", padding: "2px 0", width: "50%" }}>
                <strong>NORTH EASTERN MINDANAO STATE UNIVERSITY</strong>
                {"          "}Fund Cluster: {pr.fund_cluster || "___________"}
              </td>
            </tr>
            <tr>
              <td style={{ border: "none", padding: "2px 0" }}>
                Department: <strong>{office?.name || "___"}</strong>
              </td>
              <td style={{ border: "none", padding: "2px 0" }}>
                PR Number: <strong>{pr.pr_number || "___"}</strong>
                {"          "}
                Date:{" "}
                <strong>
                  {pr.requested_date
                    ? new Date(pr.requested_date).toLocaleDateString("en-PH", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "___"}
                </strong>
              </td>
            </tr>
            <tr>
              <td style={{ border: "none", padding: "2px 0" }} colSpan={2}>
                Responsibility Center Code:{" "}
                {pr.responsibility_center_code || "___________"}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Items table */}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#f3f4f6" }}>
              <th
                style={{
                  ...tdStyle,
                  textAlign: "center",
                  fontWeight: "bold",
                  width: "12%",
                }}
              >
                Stock/ Property No.
              </th>
              <th
                style={{
                  ...tdStyle,
                  textAlign: "center",
                  fontWeight: "bold",
                  width: "8%",
                }}
              >
                Unit
              </th>
              <th
                style={{ ...tdStyle, textAlign: "center", fontWeight: "bold" }}
              >
                Item Description
              </th>
              <th
                style={{
                  ...tdStyle,
                  textAlign: "center",
                  fontWeight: "bold",
                  width: "8%",
                }}
              >
                Quantity
              </th>
              <th
                style={{
                  ...tdStyle,
                  textAlign: "center",
                  fontWeight: "bold",
                  width: "12%",
                }}
              >
                Amount
              </th>
              <th
                style={{
                  ...tdStyle,
                  textAlign: "center",
                  fontWeight: "bold",
                  width: "12%",
                }}
              >
                Total Cost
              </th>
            </tr>
          </thead>
          <tbody>
            {pr.items.map((item, i) => {
              const isLotHeader =
                item.lot_label && !item.unit && item.quantity === 0;
              return isLotHeader ? (
                <tr key={i} style={{ backgroundColor: "#eff6ff" }}>
                  <td
                    colSpan={5}
                    style={{
                      ...tdStyle,
                      fontWeight: "bold",
                      fontStyle: "italic",
                    }}
                  >
                    {item.item_description}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>0</td>
                </tr>
              ) : (
                <tr key={i}>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    {item.stock_property_no || ""}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    {item.unit || ""}
                  </td>
                  <td style={tdStyle}>{item.item_description}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    {item.quantity}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {item.unit_price ? fmt(item.unit_price) : ""}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: "right",
                      fontWeight: "bold",
                    }}
                  >
                    {item.quantity && item.unit_price
                      ? fmt(item.quantity * item.unit_price)
                      : "0"}
                  </td>
                </tr>
              );
            })}
            <tr style={{ backgroundColor: "#FEF9C3", fontWeight: "bold" }}>
              <td colSpan={4} style={{ ...tdStyle, textAlign: "right" }}>
                Grand Total:
              </td>
              <td style={tdStyle}></td>
              <td style={{ ...tdStyle, textAlign: "right" }}>
                ₱{fmt(grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Purpose */}
        <div style={{ marginTop: "8px", fontSize: "9px" }}>
          <strong>Purpose:</strong> {pr.purpose || "___"}
        </div>

        {/* Signatures */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: "16px",
            fontSize: "9px",
          }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  border: "none",
                  width: "50%",
                  padding: "0 8px 0 0",
                  fontWeight: "bold",
                }}
              >
                Requested by:
              </td>
              <td
                style={{
                  border: "none",
                  width: "50%",
                  padding: "0 0 0 8px",
                  fontWeight: "bold",
                }}
              >
                Approved by:
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ height: "24px", border: "none" }} />
            </tr>
            <tr>
              <td style={{ border: "none", padding: "0 8px 0 0" }}>
                <div
                  style={{ borderTop: "1px solid black", paddingTop: "3px" }}
                >
                  <strong>
                    {pr.requested_by_name || "___________________________"}
                  </strong>
                  <br />
                  {pr.requested_by_designation || "Designation"}
                </div>
                <div style={{ marginTop: "6px" }}>Date: _________________</div>
              </td>
              <td style={{ border: "none", padding: "0 0 0 8px" }}>
                <div
                  style={{ borderTop: "1px solid black", paddingTop: "3px" }}
                >
                  <strong>
                    {pr.approved_by_name || "___________________________"}
                  </strong>
                  <br />
                  {pr.approved_by_designation || "Designation"}
                </div>
                <div style={{ marginTop: "6px" }}>Date: _________________</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body * { visibility: hidden; }
          #pr-print, #pr-print * { visibility: visible; }
          #pr-print { position: fixed; top: 0; left: 0; width: 100%; padding: 8mm 10mm; }
          @page { size: A4 portrait; margin: 10mm; }
        }
      `}</style>
    </div>
  );
}
