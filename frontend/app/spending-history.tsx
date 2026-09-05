import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "@/src/lib/api";
import { useLanguage } from "@/src/context/LanguageContext";
import { colors, font, fontSize, radius, spacing, shadow, formatRupiah } from "@/src/theme";

type Range = "monthly" | "yearly";
interface Point {
  period: string; // "YYYY-MM" for monthly, "YYYY" for yearly
  total: number;
}

const BAR_MAX_HEIGHT = 150;
const BAR_WIDTH = 40;

export default function SpendingHistory() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, locale } = useLanguage();

  const [range, setRange] = useState<Range>("monthly");
  const [points, setPoints] = useState<Point[]>([]);
  const [trackingSince, setTrackingSince] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (r: Range) => {
    setLoading(true);
    try {
      const res: any = await api.spendingHistory(r);
      setPoints(res.points || []);
      setTrackingSince(res.tracking_since || null);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(range);
    }, [load, range]),
  );

  const periodLabel = (period: string) => {
    if (range === "yearly") return period;
    const d = new Date(period + "-01T00:00:00");
    if (isNaN(d.getTime())) return period;
    return d.toLocaleDateString(locale, { month: "short" });
  };

  const fullPeriodLabel = (period: string) => {
    if (range === "yearly") return period;
    const d = new Date(period + "-01T00:00:00");
    if (isNaN(d.getTime())) return period;
    return d.toLocaleDateString(locale, { month: "long", year: "numeric" });
  };

  const maxTotal = Math.max(1, ...points.map((p) => p.total));
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  let trend: { dir: "up" | "down" | "flat"; pct: number } | null = null;
  if (last && prev) {
    const diff = last.total - prev.total;
    const pct = prev.total > 0 ? Math.round((Math.abs(diff) / prev.total) * 100) : 0;
    trend = { dir: diff > 0 ? "up" : diff < 0 ? "down" : "flat", pct };
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="spending-history-back" onPress={() => router.back()} style={styles.headerBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("spendingHistory.title")}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing["2xl"] }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          {t(range === "yearly" ? "spendingHistory.subtitleYearly" : "spendingHistory.subtitleMonthly")}
        </Text>

        <View style={styles.segment}>
          <Pressable
            testID="range-monthly-button"
            onPress={() => setRange("monthly")}
            style={[styles.segmentItem, range === "monthly" && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, range === "monthly" && styles.segmentTextActive]}>
              {t("spendingHistory.toggleMonthly")}
            </Text>
          </Pressable>
          <Pressable
            testID="range-yearly-button"
            onPress={() => setRange("yearly")}
            style={[styles.segmentItem, range === "yearly" && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, range === "yearly" && styles.segmentTextActive]}>
              {t("spendingHistory.toggleYearly")}
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brand} size="large" />
          </View>
        ) : points.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons name="chart-bar" size={40} color={colors.brand} />
            </View>
            <Text style={styles.emptyTitle}>{t("spendingHistory.emptyTitle")}</Text>
            <Text style={styles.emptySubtitle}>{t("spendingHistory.emptySubtitle")}</Text>
          </View>
        ) : (
          <>
            {trend && (
              <View
                style={[
                  styles.trendPill,
                  trend.dir === "down" && styles.trendPillGood,
                  trend.dir === "up" && styles.trendPillWatch,
                ]}
              >
                <MaterialCommunityIcons
                  name={trend.dir === "up" ? "trending-up" : trend.dir === "down" ? "trending-down" : "trending-neutral"}
                  size={16}
                  color={trend.dir === "up" ? "#B45309" : trend.dir === "down" ? colors.brandDark : colors.muted}
                />
                <Text
                  style={[
                    styles.trendText,
                    trend.dir === "down" && { color: colors.brandDark },
                    trend.dir === "up" && { color: "#B45309" },
                  ]}
                >
                  {t(
                    trend.dir === "up"
                      ? "spendingHistory.trendUp"
                      : trend.dir === "down"
                        ? "spendingHistory.trendDown"
                        : "spendingHistory.trendFlat",
                    { pct: trend.pct },
                  )}
                </Text>
              </View>
            )}

            <View style={styles.chartCard}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartRow}>
                {points.map((p, i) => {
                  const isLast = i === points.length - 1;
                  const barHeight = Math.max(6, (p.total / maxTotal) * BAR_MAX_HEIGHT);
                  return (
                    <View key={p.period} style={styles.barCol}>
                      <Text style={styles.barValue} numberOfLines={1}>
                        {formatRupiah(p.total)}
                      </Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.bar,
                            { height: barHeight },
                            isLast ? styles.barCurrent : styles.barPast,
                          ]}
                        />
                      </View>
                      <Text style={[styles.barLabel, isLast && styles.barLabelCurrent]} numberOfLines={1}>
                        {periodLabel(p.period)}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>

            {points.length === 1 && (
              <Text style={styles.singleNote}>
                {t(
                  range === "yearly"
                    ? "spendingHistory.singlePointNoteYearly"
                    : "spendingHistory.singlePointNote",
                  { count: 1 },
                )}
              </Text>
            )}

            <Text style={styles.currentPeriodCaption}>{fullPeriodLabel(last.period)}</Text>

            {trackingSince && (
              <Text style={styles.trackingSince}>
                {t("spendingHistory.trackingSince", { period: fullPeriodLabel(trackingSince) })}
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { paddingVertical: spacing["3xl"], alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: font.bold, fontSize: fontSize.lg, color: colors.onSurface },

  subtitle: {
    fontFamily: font.medium,
    fontSize: fontSize.base,
    color: colors.muted,
    lineHeight: 21,
    marginBottom: spacing.lg,
  },

  segment: {
    flexDirection: "row",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
    marginBottom: spacing.lg,
  },
  segmentItem: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.sm, alignItems: "center" },
  segmentActive: { backgroundColor: colors.surfaceSecondary, ...shadow.soft },
  segmentText: { fontFamily: font.semibold, fontSize: fontSize.base, color: colors.muted },
  segmentTextActive: { color: colors.brand },

  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginTop: spacing.md,
  },
  emptyIcon: {
    width: 84,
    height: 84,
    borderRadius: radius.lg,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: { fontFamily: font.bold, fontSize: fontSize.xl, color: colors.onSurface, textAlign: "center" },
  emptySubtitle: {
    fontFamily: font.regular,
    fontSize: fontSize.base,
    color: colors.onBrandTertiary,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 21,
  },

  trendPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    marginBottom: spacing.lg,
  },
  trendPillGood: { backgroundColor: colors.brandTertiary },
  trendPillWatch: { backgroundColor: "#FEF3C7" },
  trendText: { fontFamily: font.bold, fontSize: fontSize.sm, color: colors.muted },

  chartCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    ...shadow.soft,
  },
  chartRow: { alignItems: "flex-end", gap: spacing.lg, paddingHorizontal: spacing.xs },
  barCol: { alignItems: "center", width: BAR_WIDTH + 24 },
  barValue: {
    fontFamily: font.bold,
    fontSize: 11,
    color: colors.muted,
    marginBottom: spacing.xs,
    fontVariant: ["tabular-nums"],
  },
  barTrack: { height: BAR_MAX_HEIGHT, justifyContent: "flex-end" },
  bar: { width: BAR_WIDTH, borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm },
  barPast: { backgroundColor: colors.brandSecondary },
  barCurrent: { backgroundColor: colors.brand },
  barLabel: {
    fontFamily: font.semibold,
    fontSize: fontSize.sm,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  barLabelCurrent: { color: colors.brand, fontFamily: font.bold },

  singleNote: {
    fontFamily: font.medium,
    fontSize: fontSize.sm,
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.lg,
    lineHeight: 19,
  },
  currentPeriodCaption: {
    fontFamily: font.semibold,
    fontSize: fontSize.sm,
    color: colors.onSurface,
    textAlign: "center",
    marginTop: spacing.lg,
  },
  trackingSince: {
    fontFamily: font.regular,
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.xs,
  },
});
