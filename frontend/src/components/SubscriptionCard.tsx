import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getCategory } from "@/src/constants/categories";
import { colors, font, fontSize, radius, spacing, shadow, formatRupiah } from "@/src/theme";
import { useLanguage } from "@/src/context/LanguageContext";

export interface Subscription {
  id: string;
  name: string;
  category: string;
  price: number;
  billing_cycle: string;
  next_due_date: string;
  status: string;
  reminders?: number[];
  notes?: string;
  days_left?: number;
}

// Category logo tile (icon + brand tint). Falls back to initial letter overlay.
export function CategoryLogo({
  category,
  name,
  size = 48,
}: {
  category: string;
  name?: string;
  size?: number;
}) {
  const cat = getCategory(category);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.md,
        backgroundColor: cat.color + "1A",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <MaterialCommunityIcons name={cat.icon as any} size={size * 0.5} color={cat.color} />
    </View>
  );
}

function dueLabel(
  dateStr: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
  locale: string,
): { text: string; urgent: boolean } {
  const due = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (isNaN(days)) return { text: dateStr, urgent: false };
  if (days < 0) return { text: t("subscriptionCard.overdueDays", { days: Math.abs(days) }), urgent: true };
  if (days === 0) return { text: t("subscriptionCard.dueToday"), urgent: true };
  if (days === 1) return { text: t("subscriptionCard.dueTomorrow"), urgent: true };
  if (days <= 7) return { text: t("subscriptionCard.dueInDays", { days }), urgent: true };
  const d = due.toLocaleDateString(locale, { day: "numeric", month: "short" });
  return { text: d, urgent: false };
}

export function SubscriptionCard({
  sub,
  onPress,
}: {
  sub: Subscription;
  onPress: () => void;
}) {
  const { t, locale } = useLanguage();
  const cat = getCategory(sub.category);
  const due = dueLabel(sub.next_due_date, t, locale);
  const isTrial = sub.status === "trial";

  return (
    <Pressable
      testID={`sub-card-${sub.id}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
    >
      <CategoryLogo category={sub.category} name={sub.name} />
      <View style={styles.mid}>
        <Text style={styles.name} numberOfLines={1}>
          {sub.name}
        </Text>
        <View style={styles.metaRow}>
          <View style={[styles.dot, { backgroundColor: cat.color }]} />
          <Text style={styles.meta} numberOfLines={1}>
            {t(`categories.${cat.key}`)} · {t(`cycles.${sub.billing_cycle}`)}
          </Text>
        </View>
        <View style={styles.badgeRow}>
          <View
            style={[
              styles.dueBadge,
              due.urgent ? { backgroundColor: "#FEF3C7" } : { backgroundColor: colors.surfaceTertiary },
            ]}
          >
            <MaterialCommunityIcons
              name={due.urgent ? "clock-alert" : "calendar-blank"}
              size={12}
              color={due.urgent ? "#B45309" : colors.muted}
            />
            <Text
              style={[
                styles.dueText,
                { color: due.urgent ? "#B45309" : colors.muted },
              ]}
            >
              {due.text}
            </Text>
          </View>
          {isTrial && (
            <View style={styles.trialBadge}>
              <Text style={styles.trialText}>{t("subscriptionCard.trial")}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.right}>
        <Text style={styles.price}>{formatRupiah(sub.price)}</Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.borderStrong} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    ...shadow.soft,
  },
  mid: { flex: 1, gap: 3 },
  name: { fontFamily: font.bold, fontSize: fontSize.lg, color: colors.onSurface },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  dot: { width: 7, height: 7, borderRadius: 4 },
  meta: { fontFamily: font.medium, fontSize: fontSize.sm, color: colors.muted, flex: 1 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 2 },
  dueBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  dueText: { fontFamily: font.semibold, fontSize: 11 },
  trialBadge: {
    backgroundColor: colors.brandSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  trialText: { fontFamily: font.semibold, fontSize: 11, color: colors.onBrandSecondary },
  right: { alignItems: "flex-end", flexDirection: "row", gap: 2 },
  price: { fontFamily: font.extrabold, fontSize: fontSize.lg, color: colors.onSurface },
});
