import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { useToast } from "../../components/feedback/ToastProvider";
import { SkeletonRow } from "../../components/feedback/Skeleton";
import { TriangleAlert, Loader2 } from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";

interface ExpenseCategoryRow {
  id: string;
  description: string;
  procurement_order: number | null;
}

type DraftValues = Record<string, string>;

interface ValidationResult {
  valid: boolean;
  // categoryId -> error message, for values that are individually invalid
  fieldErrors: Record<string, string>;
  // categoryIds that collide with another category's order value
  duplicateIds: Set<string>;
  formError: string | null;
}

function validateDrafts(
  categories: ExpenseCategoryRow[],
  drafts: DraftValues,
): ValidationResult {
  const fieldErrors: Record<string, string> = {};
  const duplicateIds = new Set<string>();
  const seenOrders = new Map<number, string[]>(); // order -> categoryIds

  for (const category of categories) {
    const raw = drafts[category.id]?.trim() ?? "";
    if (raw === "") continue; // blank is allowed — sorts last

    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 0) {
      fieldErrors[category.id] =
        "Must be a whole number (0 or higher), or blank.";
      continue;
    }

    const ids = seenOrders.get(parsed) ?? [];
    ids.push(category.id);
    seenOrders.set(parsed, ids);
  }

  for (const ids of seenOrders.values()) {
    if (ids.length > 1) {
      ids.forEach((id) => duplicateIds.add(id));
    }
  }

  let formError: string | null = null;
  if (Object.keys(fieldErrors).length > 0) {
    formError = "Fix the highlighted values before saving.";
  } else if (duplicateIds.size > 0) {
    formError =
      "Two or more categories share the same Procurement Order. Each value must be unique.";
  }

  return {
    valid: formError === null,
    fieldErrors,
    duplicateIds,
    formError,
  };
}

export default function ProcurementOrderPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [categories, setCategories] = useState<ExpenseCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local draft text per category — nothing hits the server until
  // "Save Changes" is pressed. Keyed by category id.
  const [draftValues, setDraftValues] = useState<DraftValues>({});

  const loadCategories = useCallback(() => {
    setLoading(true);
    api
      .get("/api/expense-categories/")
      .then((res) => {
        const rows: ExpenseCategoryRow[] = res.data || [];
        setCategories(rows);
        const drafts: DraftValues = {};
        rows.forEach((c) => {
          // API FIELD: swap to c.lot_priority here if the backend column
          // hasn't been renamed yet.
          drafts[c.id] =
            c.procurement_order == null ? "" : String(c.procurement_order);
        });
        setDraftValues(drafts);
      })
      .catch(() => toast.error("Could not load procurement categories."))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const validation = useMemo(
    () => validateDrafts(categories, draftValues),
    [categories, draftValues],
  );

  // Only categories sorted for display — unset (blank) orders sort last,
  // ties broken alphabetically so the list stays stable while editing.
  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const ap = a.procurement_order ?? Number.MAX_SAFE_INTEGER;
      const bp = b.procurement_order ?? Number.MAX_SAFE_INTEGER;
      if (ap !== bp) return ap - bp;
      return a.description.localeCompare(b.description);
    });
  }, [categories]);

  const hasUnsavedChanges = useMemo(() => {
    return categories.some((c) => {
      const draft = draftValues[c.id]?.trim() ?? "";
      const original =
        c.procurement_order == null ? "" : String(c.procurement_order);
      return draft !== original;
    });
  }, [categories, draftValues]);

  const handleChange = (categoryId: string, value: string) => {
    setDraftValues((prev) => ({ ...prev, [categoryId]: value }));
  };

  const handleSave = async () => {
    if (!validation.valid) {
      return;
    }

    const changed = categories.filter((c) => {
      const draft = draftValues[c.id]?.trim() ?? "";
      const original =
        c.procurement_order == null ? "" : String(c.procurement_order);
      return draft !== original;
    });

    if (changed.length === 0) return;

    setSaving(true);

    try {
      // The existing API only exposes a per-category PUT, so changed rows
      // are saved together as one batch of parallel requests rather than
      // one-by-one on blur. If a bulk endpoint becomes available, this is
      // the only block that needs to change.
      const results = await Promise.allSettled(
        changed.map((c) => {
          const raw = draftValues[c.id]?.trim() ?? "";
          const parsed = raw === "" ? null : parseInt(raw, 10);
          // API FIELD: swap the payload key to lot_priority here if the
          // backend column hasn't been renamed yet.
          return api
            .put(`/api/expense-categories/${c.id}`, {
              procurement_order: parsed,
            })
            .then(() => ({ id: c.id, parsed }));
        }),
      );

      const failed = results.filter(
        (r): r is PromiseRejectedResult => r.status === "rejected",
      );
      const succeeded = results
        .filter(
          (
            r,
          ): r is PromiseFulfilledResult<{
            id: string;
            parsed: number | null;
          }> => r.status === "fulfilled",
        )
        .map((r) => r.value);

      if (succeeded.length > 0) {
        setCategories((prev) =>
          prev.map((c) => {
            const match = succeeded.find((s) => s.id === c.id);
            return match ? { ...c, procurement_order: match.parsed } : c;
          }),
        );
      }

      if (failed.length > 0) {
        toast.error(
          failed.length === changed.length
            ? "Could not save any changes. Please try again."
            : `${failed.length} of ${changed.length} categories failed to save. Please try again.`,
        );
      } else {
        toast.success("Procurement order saved successfully.");
      }
    } catch {
      toast.error("Could not save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-24 px-4 sm:px-0 pt-6">
      <PageHeader
        title="Procurement Order"
        subtitle="Procurement Order determines the sequence in which procurement categories are grouped on a Purchase Request. The system automatically generates LOT A, LOT B, LOT C, and so on from this order when a Purchase Request is created — end users never assign lots manually. Categories left blank sort last."
        onBack={() => navigate(-1)}
      />

      {validation.formError && (
        <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{validation.formError}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonRow key={i} columns={2} />
          ))}
        </div>
      ) : sortedCategories.length === 0 ? (
        <p className="text-sm text-gray-400">
          No procurement categories found.
        </p>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                  <th className="py-2.5 px-4 font-medium">
                    Procurement Category
                  </th>
                  <th className="py-2.5 px-4 font-medium w-40">
                    Procurement Order
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedCategories.map((category) => {
                  const isDuplicate = validation.duplicateIds.has(category.id);
                  const fieldError = validation.fieldErrors[category.id];
                  const isInvalid = isDuplicate || Boolean(fieldError);

                  return (
                    <tr key={category.id} className="border-b border-gray-50">
                      <td className="py-2.5 px-4 text-gray-800">
                        {category.description}
                      </td>
                      <td className="py-2.5 px-4">
                        <input
                          type="number"
                          min={0}
                          className={`w-24 border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 ${
                            isInvalid
                              ? "border-red-300 focus:ring-red-300/40"
                              : "border-gray-300 focus:ring-[#009CC4]/40"
                          }`}
                          placeholder="—"
                          value={draftValues[category.id] ?? ""}
                          onChange={(e) =>
                            handleChange(category.id, e.target.value)
                          }
                          aria-invalid={isInvalid}
                          aria-label={`Procurement Order for ${category.description}`}
                        />
                        {fieldError && (
                          <p className="text-xs text-red-600 mt-1">
                            {fieldError}
                          </p>
                        )}
                        {!fieldError && isDuplicate && (
                          <p className="text-xs text-red-600 mt-1">
                            Duplicate order
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !hasUnsavedChanges || !validation.valid}
              className="inline-flex items-center gap-2 bg-[#009CC4] hover:bg-[#0088AC] disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? "Saving..." : "Save Changes"}
            </button>

            {!saving && hasUnsavedChanges && (
              <span className="text-xs text-gray-400">Unsaved changes</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
