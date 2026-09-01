// Notifin design tokens — sourced from /app/design_guidelines.json
// Tactile / Playful LIGHT personality.

export const colors = {
  surface: "#F7FAF8",
  onSurface: "#182924",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#182924",
  surfaceTertiary: "#E8F0EC",
  onSurfaceTertiary: "#233B33",
  surfaceInverse: "#182924",
  onSurfaceInverse: "#FFFFFF",
  brand: "#059669",
  brandPrimary: "#059669",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#D1FAE5",
  onBrandSecondary: "#065F46",
  brandTertiary: "#ECFDF5",
  onBrandTertiary: "#047857",
  brandDark: "#047857",
  success: "#10B981",
  onSuccess: "#FFFFFF",
  warning: "#F59E0B",
  onWarning: "#FFFFFF",
  error: "#EF4444",
  onError: "#FFFFFF",
  info: "#0D9488",
  onInfo: "#FFFFFF",
  border: "#E5E7EB",
  borderStrong: "#D1D5DB",
  divider: "#F3F4F6",
  muted: "#6B7280",
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
    shadowColor: "#0B3D2E",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  soft: {
    shadowColor: "#0B3D2E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
};

export function formatRupiah(value: number): string {
  const n = Math.round(value || 0);
  return "Rp" + n.toLocaleString("id-ID");
}
