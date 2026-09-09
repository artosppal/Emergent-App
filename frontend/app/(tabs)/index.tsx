import React, { useCallback, useContext, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { useUpgrade } from "@/src/context/UpgradeContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { SubscriptionCard, Subscription, CategoryLogo } from "@/src/components/SubscriptionCard";
import { SectionTitle, EmptyState, Button } from "@/src/components/ui";
import { getCategory } from "@/src/constants/categories";
import { colors, font, fontSize, radius, spacing, shadow, formatRupiah } from "@/src/theme";

interface PromoItem {
  id: string;
  title: string;
  description: string;
  app_name?: string | null;
  url?: string | null;
}

interface DashboardData {
  total_this_month: number;
  projection_next_month: number;
  active_count: number;
  plan: string;
  free_limit: number;
  upcoming: Subscription[];
  most_expensive?: (Subscription & { monthly_cost: number }) | null;
  ending_trials?: Subscription[];
  by_category: { category: string; total: number; count: number }[];
}

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const tabH = useContext(BottomTabBarHeightContext) ?? 64 + insets.bottom;
  const router = useRouter();
  const { user } = useAuth();
  const { showUpgrade } = useUpgrade();
  const { t } = useLanguage();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promos, setPromos] = useState<PromoItem[] | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  const togglePromo = async () => {
    const next = !promoOpen;
    setPromoOpen(next);
    if (next && promos === null) {
      setPromoLoading(true);
      try {
        const res: any = await api.promos();
        setPromos(res.promos || []);
      } catch {
        setPromos([]);
      } finally {
        setPromoLoading(false);
      }
    }
  };

  const load = useCallback(async () => {
    try {
      const res: any = await api.dashboard();
      setData(res);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 11) return t("dashboard.greetingMorning");
    if (h < 15) return t("dashboard.greetingAfternoon");
    if (h < 19) return t("dashboard.greetingEvening");
    return t("dashboard.greetingNight");
  };

  const firstName = (user?.name || "").split(" ")[0] || t("dashboard.you");
  const maxCat = data?.by_category?.[0]?.total || 1;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }

  const isEmpty = !data || data.active_count === 0;

  const monthlyLimit = user?.monthly_limit || null;
  const limitPct = monthlyLimit ? Math.round(((data?.total_this_month || 0) / monthlyLimit) * 100) : null;
  const limitStatus: "safe" | "warning" | "over" | null =
    limitPct === null ? null : limitPct >= 100 ? "over" : limitPct >= 85 ? "warning" : "safe";
  const totalCardColors: [string, string] =
    limitStatus === "over"
      ? ["#EF4444", "#B91C1C"]
      : limitStatus === "warning"
        ? ["#F59E0B", "#B45309"]
        : [colors.brand, colors.brandDark];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: tabH + spacing.xl }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{greeting()},</Text>
          <Text style={styles.userName}>{firstName} 👋</Text>
        </View>
        {data?.plan === "premium" ? (
          <View style={styles.premiumPill}>
            <MaterialCommunityIcons name="crown" size={14} color="#B45309" />
            <Text style={styles.premiumPillText}>{t("dashboard.premium")}</Text>
          </View>
        ) : (
          <View style={styles.freePill}>
            <Text style={styles.freePillText}>
              {data?.active_count}/{data?.free_limit}
            </Text>
          </View>
        )}
      </View>

      {/* Total spend card */}
      <View style={styles.section}>
        <Pressable
          testID="total-spend-card"
          onPress={() => router.push("/spending-history")}
          style={({ pressed }) => pressed && { opacity: 0.92 }}
        >
        <LinearGradient
          colors={totalCardColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.totalCard}
        >
          <View style={styles.totalTopRow}>
            <Text style={styles.totalLabel}>{t("dashboard.totalLabel")}</Text>
            <MaterialCommunityIcons name="wallet" size={20} color="rgba(255,255,255,0.85)" />
          </View>
          <Text style={styles.totalValue}>{formatRupiah(data?.total_this_month || 0)}</Text>
          <View style={styles.projRow}>
            <MaterialCommunityIcons name="chart-line" size={15} color="rgba(255,255,255,0.85)" />
            <Text style={styles.projText}>
              {t("dashboard.projection", { value: formatRupiah(data?.projection_next_month || 0) })}
            </Text>
          </View>
          {limitPct !== null && (
            <View testID="limit-progress-row" style={styles.projRow}>
              <MaterialCommunityIcons
                name={
                  limitStatus === "over"
                    ? "alert-octagon"
                    : limitStatus === "warning"
                      ? "alert"
                      : "shield-check"
                }
                size={15}
                color="rgba(255,255,255,0.85)"
              />
              <Text style={styles.projText}>
                {t("dashboard.limitProgress", { pct: limitPct, limit: formatRupiah(monthlyLimit || 0) })}
              </Text>
            </View>
          )}
          <View style={styles.chartHintRow}>
            <MaterialCommunityIcons name="chart-bar" size={13} color="rgba(255,255,255,0.85)" />
            <Text style={styles.chartHintText}>{t("dashboard.viewChart")}</Text>
            <MaterialCommunityIcons name="chevron-right" size={15} color="rgba(255,255,255,0.85)" />
          </View>
        </LinearGradient>
        </Pressable>
      </View>

      {/* Promo recommendations — Premium-only, admin-curated */}
      <View style={styles.section}>
        {data?.plan === "premium" ? (
          <View style={styles.promoCard}>
            <Pressable testID="promo-card-toggle" onPress={togglePromo} style={styles.promoHeaderRow}>
              <View style={styles.promoIconWrap}>
                <MaterialCommunityIcons name="gift-outline" size={18} color="#92400E" />
              </View>
              <Text style={styles.promoTitle}>{t("dashboard.promoCardTitle")}</Text>
              <MaterialCommunityIcons
                name={promoOpen ? "chevron-up" : "chevron-down"}
                size={20}
                color="#92400E"
              />
            </Pressable>
            {promoOpen && (
              <View style={styles.promoBody}>
                {promoLoading ? (
                  <ActivityIndicator color="#B45309" style={{ marginVertical: spacing.lg }} />
                ) : promos && promos.length > 0 ? (
                  promos.map((p) => (
                    <View key={p.id} style={styles.promoItem}>
                      <Text style={styles.promoItemTitle}>
                        {p.title}
                        {p.app_name ? ` · ${p.app_name}` : ""}
                      </Text>
                      <Text style={styles.promoItemDesc}>{p.description}</Text>
                      {!!p.url && (
                        <Pressable onPress={() => Linking.openURL(p.url!)}>
                          <Text style={styles.promoItemLink} numberOfLines={1}>
                            {p.url}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  ))
                ) : (
                  <View style={{ alignItems: "center", paddingVertical: spacing.md }}>
                    <Text style={styles.promoEmptyTitle}>{t("dashboard.promoEmptyTitle")}</Text>
                    <Text style={styles.promoEmptySub}>{t("dashboard.promoEmptySubtitle")}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        ) : (
          <Pressable testID="promo-card-locked" onPress={showUpgrade} style={styles.promoLockedCard}>
            <View style={styles.promoLockIconWrap}>
              <MaterialCommunityIcons name="lock" size={18} color="#6B7280" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.promoLockedTitle}>{t("dashboard.promoCardTitle")}</Text>
              <Text style={styles.promoLockedSub}>{t("dashboard.promoCardLockedSub")}</Text>
            </View>
            <View style={styles.promoUnlockPill}>
              <MaterialCommunityIcons name="crown" size={11} color="#B45309" />
              <Text style={styles.promoUnlockPillText}>{t("dashboard.promoCardUnlock")}</Text>
            </View>
          </Pressable>
        )}
      </View>

      {isEmpty ? (
        <View style={{ marginTop: spacing.lg }}>
          <EmptyState
            icon="rocket-launch"
            title={t("dashboard.emptyTitle")}
            subtitle={t("dashboard.emptySubtitle")}
            cta={
              <Button
                testID="empty-add-button"
                title={t("dashboard.addButton")}
                icon="plus"
                onPress={() => router.push("/subscription/form")}
              />
            }
          />
        </View>
      ) : (
        <>
          {/* Ringkasan boros */}
          {(data?.most_expensive || (data?.ending_trials && data.ending_trials.length > 0)) && (
            <View style={styles.section}>
              <SectionTitle title={t("dashboard.highlightSection")} />
              <View style={{ gap: spacing.md }}>
                {data?.most_expensive && (
                  <Pressable
                    testID="most-expensive-card"
                    onPress={() =>
                      router.push({
                        pathname: "/subscription/form",
                        params: { id: data.most_expensive!.id },
                      })
                    }
                    style={({ pressed }) => [styles.borosCard, pressed && { opacity: 0.9 }]}
                  >
                    <CategoryLogo category={data.most_expensive.category} size={44} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.borosLabel}>{t("dashboard.mostExpensiveLabel")}</Text>
                      <Text style={styles.borosName} numberOfLines={1}>
                        {data.most_expensive.name}
                        {data.most_expensive.registered_with
                          ? ` (${data.most_expensive.registered_with})`
                          : ""}
                      </Text>
                      <Text style={styles.borosMeta}>
                        {t("dashboard.mostExpensiveMeta", {
                          price: formatRupiah(data.most_expensive.monthly_cost),
                          pct: Math.round(
                            (data.most_expensive.monthly_cost / (data.total_this_month || 1)) * 100,
                          ),
                        })}
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.borderStrong} />
                  </Pressable>
                )}
                {data?.ending_trials?.map((tr) => (
                  <Pressable
                    key={tr.id}
                    testID={`trial-warning-${tr.id}`}
                    onPress={() =>
                      router.push({ pathname: "/subscription/form", params: { id: tr.id } })
                    }
                    style={({ pressed }) => [styles.trialWarnCard, pressed && { opacity: 0.9 }]}
                  >
                    <MaterialCommunityIcons name="timer-sand" size={22} color="#B45309" />
                    <Text style={styles.trialWarnText} numberOfLines={2}>
                      {t("dashboard.trialWarning", {
                        name: tr.registered_with ? `${tr.name} (${tr.registered_with})` : tr.name,
                        ending:
                          tr.days_left === 0
                            ? t("dashboard.trialEndsToday")
                            : tr.days_left === 1
                              ? t("dashboard.trialEndsTomorrow")
                              : t("dashboard.trialEndsIn", { days: tr.days_left ?? 0 }),
                      })}
                    </Text>
                    <MaterialCommunityIcons name="chevron-right" size={20} color="#B45309" />
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Upcoming */}
          <View style={styles.section}>
            <SectionTitle title={t("dashboard.upcomingSection")} />
            {data && data.upcoming.length > 0 ? (
              <View style={{ gap: spacing.md }}>
                {data.upcoming.map((s) => (
                  <SubscriptionCard
                    key={s.id}
                    sub={s}
                    onPress={() => router.push({ pathname: "/subscription/form", params: { id: s.id } })}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.calmCard}>
                <MaterialCommunityIcons name="check-circle" size={22} color={colors.success} />
                <Text style={styles.calmText}>{t("dashboard.calmText")}</Text>
              </View>
            )}
          </View>

          {/* By category */}
          {data && data.by_category.length > 0 && (
            <View style={styles.section}>
              <SectionTitle title={t("dashboard.categorySection")} />
              <View style={styles.chartCard}>
                {data.by_category.map((c) => {
                  const cat = getCategory(c.category);
                  const pct = Math.max(0.06, c.total / maxCat);
                  return (
                    <View key={c.category} style={styles.chartRow}>
                      <View style={styles.chartHead}>
                        <View style={[styles.catDot, { backgroundColor: cat.color }]}>
                          <MaterialCommunityIcons name={cat.icon as any} size={13} color="#fff" />
                        </View>
                        <Text style={styles.chartLabel}>{t(`categories.${cat.key}`)}</Text>
                        <Text style={styles.chartValue}>{formatRupiah(c.total)}</Text>
                      </View>
                      <View style={styles.track}>
                        <View
                          style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: cat.color }]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  greeting: { fontFamily: font.medium, fontSize: fontSize.base, color: colors.muted },
  userName: { fontFamily: font.extrabold, fontSize: fontSize["2xl"], color: colors.onSurface },
  premiumPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  premiumPillText: { fontFamily: font.bold, fontSize: fontSize.sm, color: "#B45309" },
  freePill: {
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  freePillText: { fontFamily: font.bold, fontSize: fontSize.sm, color: colors.onSurfaceTertiary },

  section: { paddingHorizontal: spacing.xl, marginTop: spacing.lg },
  totalCard: { borderRadius: radius.lg, padding: spacing.xl, ...shadow.card },
  totalTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontFamily: font.semibold, fontSize: fontSize.base, color: "rgba(255,255,255,0.9)" },
  totalValue: { fontFamily: font.extrabold, fontSize: 40, color: "#FFFFFF", marginTop: spacing.sm },
  projRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.md },
  projText: { fontFamily: font.medium, fontSize: fontSize.base, color: "rgba(255,255,255,0.9)" },
  chartHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.25)",
  },
  chartHintText: { fontFamily: font.bold, fontSize: fontSize.sm, color: "rgba(255,255,255,0.95)" },

  calmCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  calmText: { flex: 1, fontFamily: font.medium, fontSize: fontSize.base, color: colors.onBrandTertiary },

  borosCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.soft,
  },
  borosLabel: { fontFamily: font.semibold, fontSize: 11, color: colors.muted },
  borosName: { fontFamily: font.bold, fontSize: fontSize.lg, color: colors.onSurface, marginTop: 1 },
  borosMeta: { fontFamily: font.semibold, fontSize: fontSize.sm, color: colors.error, marginTop: 1 },
  trialWarnCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: "#FEF3C7",
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  trialWarnText: { flex: 1, fontFamily: font.medium, fontSize: fontSize.base, color: "#92400E", lineHeight: 20 },

  chartCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.lg, ...shadow.soft },
  chartRow: { gap: spacing.sm },
  chartHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  catDot: { width: 22, height: 22, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  chartLabel: { flex: 1, fontFamily: font.semibold, fontSize: fontSize.base, color: colors.onSurface },
  chartValue: { fontFamily: font.bold, fontSize: fontSize.base, color: colors.onSurface },
  track: { height: 9, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  fill: { height: 9, borderRadius: radius.pill },

  promoCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#FDE68A",
    overflow: "hidden",
  },
  promoHeaderRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  promoIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  promoTitle: { flex: 1, fontFamily: font.bold, fontSize: fontSize.base, color: "#92400E" },
  promoBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md },
  promoItem: {
    backgroundColor: "rgba(255,255,255,0.55)",
    borderRadius: radius.md,
    padding: spacing.md,
  },
  promoItemTitle: { fontFamily: font.bold, fontSize: fontSize.base, color: "#78350F" },
  promoItemDesc: { fontFamily: font.regular, fontSize: fontSize.sm, color: "#92400E", marginTop: 2, lineHeight: 19 },
  promoItemLink: { fontFamily: font.semibold, fontSize: fontSize.sm, color: "#B45309", marginTop: spacing.xs },
  promoEmptyTitle: { fontFamily: font.bold, fontSize: fontSize.base, color: "#92400E" },
  promoEmptySub: {
    fontFamily: font.regular,
    fontSize: fontSize.sm,
    color: "#B45309",
    marginTop: 2,
    textAlign: "center",
  },

  promoLockedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.soft,
  },
  promoLockIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  promoLockedTitle: { fontFamily: font.bold, fontSize: fontSize.base, color: colors.onSurface },
  promoLockedSub: { fontFamily: font.regular, fontSize: fontSize.sm, color: colors.muted, marginTop: 2, lineHeight: 18 },
  promoUnlockPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  promoUnlockPillText: { fontFamily: font.bold, fontSize: 10, color: "#B45309" },
});
