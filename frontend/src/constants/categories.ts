// Subscription categories with Indonesian labels + MaterialCommunityIcons + accent colors.

export type CategoryKey =
  | "entertainment"
  | "music"
  | "productivity"
  | "education"
  | "gaming"
  | "cloud"
  | "shopping"
  | "health"
  | "news"
  | "utilities"
  | "other";

export interface CategoryDef {
  key: CategoryKey;
  label: string;
  icon: string; // MaterialCommunityIcons name
  color: string;
}

export const CATEGORIES: CategoryDef[] = [
  { key: "entertainment", label: "Hiburan", icon: "movie-open", color: "#EF4444" },
  { key: "music", label: "Musik", icon: "music", color: "#8B5CF6" },
  { key: "productivity", label: "Produktivitas", icon: "briefcase-variant", color: "#0EA5E9" },
  { key: "education", label: "Edukasi", icon: "school", color: "#F59E0B" },
  { key: "gaming", label: "Game", icon: "gamepad-variant", color: "#6366F1" },
  { key: "cloud", label: "Cloud & Storage", icon: "cloud", color: "#3B82F6" },
  { key: "shopping", label: "Belanja", icon: "cart", color: "#10B981" },
  { key: "health", label: "Kesehatan", icon: "heart-pulse", color: "#EC4899" },
  { key: "news", label: "Berita", icon: "newspaper-variant", color: "#14B8A6" },
  { key: "utilities", label: "Utilitas", icon: "wrench", color: "#64748B" },
  { key: "other", label: "Lainnya", icon: "dots-horizontal-circle", color: "#059669" },
];

export const CATEGORY_MAP: Record<string, CategoryDef> = CATEGORIES.reduce(
  (acc, c) => {
    acc[c.key] = c;
    return acc;
  },
  {} as Record<string, CategoryDef>,
);

export function getCategory(key?: string): CategoryDef {
  return (key && CATEGORY_MAP[key]) || CATEGORY_MAP.other;
}

export const BILLING_CYCLES = [
  { key: "weekly", label: "Mingguan" },
  { key: "monthly", label: "Bulanan" },
  { key: "yearly", label: "Tahunan" },
];

export const STATUS_OPTIONS = [
  { key: "paid", label: "Sudah Bayar" },
  { key: "trial", label: "Trial Gratis" },
];

export function cycleLabel(cycle: string): string {
  return BILLING_CYCLES.find((c) => c.key === cycle)?.label || cycle;
}
