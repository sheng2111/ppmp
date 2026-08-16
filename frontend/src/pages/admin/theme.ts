// ── EPPS Design Tokens ───────────────────────────────────────────────────
// Single source of truth for color, gradient, and font choices across the
// app. Import from here instead of redefining constants in each page —
// that way a brand tweak (e.g. swapping the accent blue) only happens once.
//
// Values below are unchanged from LoginPage.tsx / Layout.tsx — this file
// only centralizes them, it does not alter any color, weight, or spacing.

export const colors = {
  // Core brand
  primary: "#0284C7",
  primaryHover: "#0EA5E9",
  heading: "#0369A1",

  // Text
  text: "#1E293B",
  textMuted: "#64748B",
  textFaint: "#94A3B8", // slate-400, used for placeholders/footnotes

  // Surfaces & borders
  border: "#E2E8F0",
  fieldBg: "#F8FAFC",
  appBg: "#F1F5F9", // main content background (Layout)

  // Active / selected nav state
  activeBg: "#E0F2FE",
  activeBorder: "#0EA5E9",
  activeText: "#0369A1",
  sectionLabel: "#0369A1",

  // Hover surfaces
  hoverBg: "#F0F9FF",

  // Feedback states
  success: "#10B981",
  successBg: "#F0FDF4",
  successBorder: "#BBF7D0",
  warning: "#F59E0B",
  warningBg: "#FFFBEB",
  warningBorder: "#FDE68A",
  error: "#EF4444",
  errorBg: "#FEF2F2",
  errorBorder: "#FECACA",
};

export const gradients = {
  header: "linear-gradient(135deg, #2563EB 0%, #0EA5E9 55%, #06B6D4 100%)",
  page: "linear-gradient(135deg, #0B2A5B 0%, #1D4ED8 45%, #0EA5E9 100%)",
};

// Chart palette (bar/pie fills) — moved here from DashboardPage.tsx's local
// copy so both dashboards draw from one source. Values unchanged.
export const chartColors = [
  "#0284C7",
  "#0EA5E9",
  "#38BDF8",
  "#7DD3FC",
  "#BAE6FD",
  "#0369A1",
];

export const font = {
  stack: "'Inter', 'Poppins', system-ui, sans-serif",
};

// Convenience default export for `import theme from "../../lib/theme"`
const theme = { colors, gradients, font, chartColors };
export default theme;
