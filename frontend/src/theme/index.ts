// Notifin design tokens.
// Brand direction: blue primary (see Notifin_Claude_Code_UI_Implementation_Brief.md,
// section 1.2 — overridden from that doc's "green" call per explicit user decision
// 2026-09-22: blue is the final brand color, not green). Success/warning/error stay
// semantic (not brand-tied) per the brief's own color rules.

export const colors = {
  surface: "#F6F8FC",
  onSurface: "#0B1746",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#0B1746",
  surfaceTertiary: "#EAF1FB",
  onSurfaceTertiary: "#1E3A6E",
  surfaceInverse: "#0B1746",
  onSurfaceInverse: "#FFFFFF",
  brand: "#2563EB",
  brandPrimary: "#2563EB",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#DBEAFE",
  onBrandSecondary: "#1D4ED8",
  brandTertiary: "#EFF6FF",
  onBrandTertiary: "#1D4ED8",
  brandDark: "#1D4ED8",
  success: "#10B981",
  onSuccess: "#FFFFFF",
  warning: "#F59E0B",
  onWarning: "#FFFFFF",
  error: "#EF4444",
  onError: "#FFFFFF",
  info: "#0D9488",
  onInfo: "#FFFFFF",
  border: "#E1E7F2",
  borderStrong: "#C7D2E6",
  divider: "#EEF2F9",
  muted: "#64748B",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
};

// Caps how wide app content grows on desktop web so pages read as a single
// centered column instead of mobile UI stretched edge-to-edge. No effect on
// phone-width screens since they never exceed these values.
export const webMaxWidth = 760;
export const webFormMaxWidth = 480;

// Below this window width, the app shell falls back to bottom tabs even on
// web — a left sidebar needs room for both itself and the content column.
export const sidebarBreakpoint = 900;
export const sidebarWidthExpanded = 248;
export const sidebarWidthCollapsed = 76;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};

export const font = {
  regular: "PlusJakarta-Regular",
  medium: "PlusJakarta-Medium",
  semibold: "PlusJakarta-SemiBold",
  bold: "PlusJakarta-Bold",
  extrabold: "PlusJakarta-ExtraBold",
};

export const fontSize = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 38,
};

export const shadow = {
  card: {
    boxShadow: "0px 6px 16px rgba(15, 35, 90, 0.08)",
    elevation: 3,
  },
  soft: {
    boxShadow: "0px 2px 8px rgba(15, 35, 90, 0.05)",
    elevation: 2,
  },
};

export function formatRupiah(value: number): string {
  const n = Math.round(value || 0);
  return "Rp" + n.toLocaleString("id-ID");
}
