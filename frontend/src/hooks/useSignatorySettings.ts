import { useEffect, useState } from "react";
import api from "../services/api";

// Mirrors app/services/signatory.py's SIGNATORY_THRESHOLD exactly. The
// threshold itself is a fixed business rule (not admin-editable) — only
// the NAMES that fill each role are, via SignatorySettings. It applies
// ONLY to Requested By/Approved By — BAC Secretariat Chairman and Budget
// Officer never branch on it (see previewSignatories below).
export const SIGNATORY_THRESHOLD = 50000.0;

export interface SignatorySettings {
  campus_director_name: string;
  campus_director_designation: string;
  suc_president_name: string;
  suc_president_designation: string;
  bac_secretariat_chairman_name: string;
  bac_secretariat_chairman_designation: string;
  budget_officer_name: string;
  budget_officer_designation: string;
  updated_at: string;
}

export interface SignatoryPreview {
  requestedByName: string;
  requestedByDesignation: string;
  approvedByName: string;
  approvedByDesignation: string;
}

// Sensible fallbacks ONLY for the brief window before the settings fetch
// resolves (or if it fails) — never used once the real values load. The
// backend's own resolve_signatories() is always the source of truth for
// what actually gets saved, printed, and exported.
const FALLBACK_CAMPUS_DIRECTOR_NAME = "Ariston O. Ronquillo, DM";
const FALLBACK_CAMPUS_DIRECTOR_DESIGNATION = "Campus Director";
const FALLBACK_SUC_PRESIDENT_NAME = "Nemesio G. Loayon, PhD";
const FALLBACK_SUC_PRESIDENT_DESIGNATION = "SUC President III";
export const FALLBACK_BAC_SECRETARIAT_CHAIRMAN_NAME = "Nestle R. Amuray";
export const FALLBACK_BAC_SECRETARIAT_CHAIRMAN_DESIGNATION =
  "BAC Secretariat Chairman";
export const FALLBACK_BUDGET_OFFICER_NAME = "Darlene Abigail T. Dabalos";
export const FALLBACK_BUDGET_OFFICER_DESIGNATION = "Designate, Budget Officer";

/**
 * Fetches the CURRENT signatory names from the backend
 * (app/routers/signatory_settings.py) rather than hardcoding them
 * client-side. When an admin updates a signatory — e.g. after a
 * retirement — every open Create/Edit PR page picks it up on next load,
 * with no frontend deploy required.
 *
 * Shared by CreatePRPage and EditPRPage so the fetch + preview logic
 * lives in exactly one place instead of being duplicated across both.
 */
export function useSignatorySettings() {
  const [settings, setSettings] = useState<SignatorySettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/settings/signatories")
      .then((res) => setSettings(res.data))
      .catch(() => setSettings(null))
      .finally(() => setLoading(false));
  }, []);

  return { settings, loading };
}

/**
 * Mirrors app/services/signatory.py's resolve_signatories exactly, for
 * instant on-screen feedback as items are selected/edited. This is a
 * PREVIEW ONLY — the backend recomputes and persists the authoritative
 * values on every save (create and edit), so even a stale or failed
 * settings fetch here can never cause a wrong signatory to actually be
 * saved, printed, or exported.
 *
 * Only covers Requested By/Approved By, which branch on
 * SIGNATORY_THRESHOLD. BAC Secretariat Chairman and Budget Officer don't
 * need a "preview" — they're always the same two current people
 * regardless of Grand Total, so read settings.bac_secretariat_chairman_name
 * etc. directly wherever needed.
 */
export function previewSignatories(
  grandTotal: number,
  settings: SignatorySettings | null,
  endUserName?: string | null,
  endUserDesignation?: string | null,
): SignatoryPreview {
  const campusDirectorName =
    settings?.campus_director_name || FALLBACK_CAMPUS_DIRECTOR_NAME;
  const campusDirectorDesignation =
    settings?.campus_director_designation ||
    FALLBACK_CAMPUS_DIRECTOR_DESIGNATION;
  const sucPresidentName =
    settings?.suc_president_name || FALLBACK_SUC_PRESIDENT_NAME;
  const sucPresidentDesignation =
    settings?.suc_president_designation || FALLBACK_SUC_PRESIDENT_DESIGNATION;

  if (grandTotal < SIGNATORY_THRESHOLD) {
    return {
      requestedByName: endUserName || "End User",
      requestedByDesignation: endUserDesignation || "End User",
      approvedByName: campusDirectorName,
      approvedByDesignation: campusDirectorDesignation,
    };
  }
  return {
    requestedByName: campusDirectorName,
    requestedByDesignation: campusDirectorDesignation,
    approvedByName: sucPresidentName,
    approvedByDesignation: sucPresidentDesignation,
  };
}
