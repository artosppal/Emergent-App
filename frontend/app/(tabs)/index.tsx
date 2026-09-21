import React, { useCallback, useContext, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Share,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { Image } from "expo-image";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import DateTimePicker from "@react-native-community/datetimepicker";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { useUpgrade } from "@/src/context/UpgradeContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { useToast } from "@/src/context/ToastContext";
import { Subscription, CategoryLogo } from "@/src/components/SubscriptionCard";
import { EmptyState, Button } from "@/src/components/ui";
import { DonutChart, DonutSlice } from "@/src/components/dashboard/DonutChart";
import { getCategory } from "@/src/constants/categories";
import {
  colors,
  font,
  fontSize,
  radius,
  spacing,
  shadow,
  formatRupiah,
  sidebarBreakpoint,
} from "@/src/theme";

// This page's content area is deliberately wider than the app's usual
// mobile-style `webMaxWidth` cap — the desktop dashboard is a real 3-column
// layout, not a centered mobile column stretched onto a big screen.
const WIDE_CONTENT_MAX = 1180;
const MOBILE_CONTENT_MAX = 560;

interface PromoItem {
  id: string;
  title: string;
  description: string;
  app_name?: string | null;
  has_link?: boolean;
}

interface SubWithMeta extends Subscription {
  created_at?: string;
}

interface EndingTrial extends Subscription {
  monthly_cost?: number;
}

function toLocalDateTimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const webDateTimeInputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  fontFamily: font.semibold,
  fontSize: fontSize.base,
  color: colors.onSurface,
  padding: 0,
};

interface DashboardData {
  total_this_month: number;
  projection_next_month: number;
  active_count: number;
  plan: string;
  free_limit: number;
  upcoming: Subscription[];
  most_expensive?: (Subscription & { monthly_cost: number }) | null;
  ending_trials?: EndingTrial[];
  by_category: { category: string; total: number; count: number }[];
}

// ---------------------------------------------------------------------------
// Small presentational pieces used only on this screen.
// ---------------------------------------------------------------------------

function dueTone(days: number): { bg: string; fg: string } {
  if (days <= 0) return { bg: "#FEE2E2", fg: "#B91C1C" };
  if (days <= 2) return { bg: "#FEF3C7", fg: "#B45309" };
  return { bg: colors.brandTertiary, fg: colors.onBrandTertiary };
}

function dueLabelText(days: number, t: (k: string, v?: any) => string): string {
  if (days <= 0) return t("subscriptionCard.dueToday");
  if (days === 1) return t("subscriptionCard.dueTomorrow");
  return t("subscriptionCard.dueInDays", { days });
}

function addedLabelText(createdAt: string | undefined, t: (k: string, v?: any) => string): string {
  if (!createdAt) return "";
  const created = new Date(createdAt);
  if (isNaN(created.getTime())) return "";
  const createdDay = new Date(created);
  createdDay.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - createdDay.getTime()) / 86400000);
  if (days <= 0) return t("dashboard.recentAddedToday");
  if (days === 1) return t("dashboard.recentAddedYesterday");
  return t("dashboard.recentAddedDaysAgo", { days });
}

function StatCard({
  icon,
  label,
  value,
  sub,
  tint,
  wide,
  onPress,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  tint: string;
  wide: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.statCard,
        { flexBasis: wide ? undefined : "48%", flexGrow: wide ? 1 : 0 },
        onPress && pressed && { opacity: 0.9 },
      ]}
    >
      <View style={styles.statTopRow}>
        <Text style={styles.statLabel} numberOfLines={1}>
          {label}
        </Text>
        <View style={[styles.statIconWrap, { backgroundColor: tint + "1A" }]}>
          <MaterialCommunityIcons name={icon as any} size={15} color={tint} />
        </View>
      </View>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      {!!sub && (
        <Text style={styles.statSub} numberOfLines={1}>
          {sub}
        </Text>
      )}
    </Pressable>
  );
}

type BannerTone = "danger" | "brand" | "amber";

const BANNER_PALETTE: Record<BannerTone, { bg: string; border: string; strong: string; fg: string; btnBg: string; btnFg: string }> = {
  danger: { bg: "#FEF2F2", border: "#FECACA", strong: "#991B1B", fg: "#B91C1C", btnBg: "#DC2626", btnFg: "#FFFFFF" },
  brand: { bg: colors.brandTertiary, border: "#A7F3D0", strong: colors.brandDark, fg: colors.onBrandTertiary, btnBg: colors.brand, btnFg: "#FFFFFF" },
  amber: { bg: "#FFFBEB", border: "#FDE68A", strong: "#92400E", fg: "#B45309", btnBg: "#F59E0B", btnFg: "#FFFFFF" },
};

function BannerCard({
  tone,
  icon,
  title,
  sub,
  cta,
  wide,
  onPress,
  testID,
}: {
  tone: BannerTone;
  icon: string;
  title: string;
  sub: string;
  cta: string;
  wide: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const p = BANNER_PALETTE[tone];
  return (
    <View
      style={[
        styles.bannerCard,
        { backgroundColor: p.bg, borderColor: p.border, flexBasis: wide ? "31%" : "100%", flexGrow: wide ? 1 : 0 },
      ]}
    >
      <MaterialCommunityIcons name={icon as any} size={20} color={p.fg} />
      <Text style={[styles.bannerTitle, { color: p.strong }]} numberOfLines={2}>
        {title}
      </Text>
      <Text style={[styles.bannerSub, { color: p.fg }]} numberOfLines={2}>
        {sub}
      </Text>
      <Pressable testID={testID} onPress={onPress} style={[styles.bannerBtn, { backgroundColor: p.btnBg }]}>
        <Text style={[styles.bannerBtnText, { color: p.btnFg }]}>{cta}</Text>
        <MaterialCommunityIcons name="arrow-right" size={13} color={p.btnFg} />
      </Pressable>
    </View>
  );
}

function DashCard({
  title,
  seeAllLabel,
  onSeeAll,
  extra,
  children,
}: {
  title: string;
  seeAllLabel?: string;
  onSeeAll?: () => void;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.dashCard}>
      <View style={styles.dashCardHead}>
        <Text style={styles.dashCardTitle}>{title}</Text>
        {extra}
        {onSeeAll && (
          <Pressable onPress={onSeeAll} hitSlop={6}>
            <Text style={styles.dashCardSeeAll}>{seeAllLabel} →</Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

function ListRow({
  category,
  name,
  metaText,
  rightBadgeText,
  rightBadgeTone,
  rightText,
  onPress,
}: {
  category: string;
  name: string;
  metaText: string;
  rightBadgeText?: string;
  rightBadgeTone?: { bg: string; fg: string };
  rightText?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.9 }]}>
      <CategoryLogo category={category} size={38} />
      <View style={{ flex: 1 }}>
        <Text style={styles.listRowName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.listRowMeta} numberOfLines={1}>
          {metaText}
        </Text>
      </View>
      {rightBadgeText && rightBadgeTone && (
        <View style={[styles.listRowBadge, { backgroundColor: rightBadgeTone.bg }]}>
          <Text style={[styles.listRowBadgeText, { color: rightBadgeTone.fg }]} numberOfLines={1}>
            {rightBadgeText}
          </Text>
        </View>
      )}
      {rightText && (
        <Text style={styles.listRowRightText} numberOfLines={1}>
          {rightText}
        </Text>
      )}
    </Pressable>
  );
}

function RecommendCard({
  promo,
  ctaLabel,
  onJoin,
  onRemind,
}: {
  promo: PromoItem;
  ctaLabel: string;
  onJoin: () => void;
  onRemind: () => void;
}) {
  return (
    <View style={styles.recommendCard}>
      <View style={styles.recommendIconWrap}>
        <MaterialCommunityIcons name="tag-heart-outline" size={20} color={colors.brand} />
      </View>
      <Text style={styles.recommendTitle} numberOfLines={2}>
        {promo.title}
      </Text>
      {!!promo.app_name && (
        <Text style={styles.recommendApp} numberOfLines={1}>
          {promo.app_name}
        </Text>
      )}
      <Text style={styles.recommendDesc} numberOfLines={3}>
        {promo.description}
      </Text>
      <View style={styles.recommendActions}>
        {!!promo.has_link && (
          <Pressable testID={`recommend-join-${promo.id}`} style={styles.recommendCta} onPress={onJoin}>
            <Text style={styles.recommendCtaText}>{ctaLabel}</Text>
          </Pressable>
        )}
        <Pressable
          testID={`recommend-remind-${promo.id}`}
          style={styles.recommendRemindBtn}
          onPress={onRemind}
          hitSlop={6}
        >
          <MaterialCommunityIcons name="bell-outline" size={16} color={colors.brand} />
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const tabH = useContext(BottomTabBarHeightContext) ?? 64 + insets.bottom;
  const router = useRouter();
  const { user } = useAuth();
  const { showUpgrade } = useUpgrade();
  const { t, locale } = useLanguage();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const isWide = width >= sidebarBreakpoint;

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastMonthTotal, setLastMonthTotal] = useState<number | null>(null);
  const [recentSubs, setRecentSubs] = useState<SubWithMeta[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [promos, setPromos] = useState<PromoItem[] | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  const [remindPromoId, setRemindPromoId] = useState<string | null>(null);
  const [remindCustomValue, setRemindCustomValue] = useState("");
  const [remindNativeStep, setRemindNativeStep] = useState<"date" | "time" | null>(null);
  const [remindNativeDate, setRemindNativeDate] = useState(new Date());

  const openPromo = (id: string) => {
    Linking.openURL(api.promoGoUrl(id));
  };

  const scheduleRemind = async (promoId: string, when: Date) => {
    setRemindPromoId(null);
    setRemindCustomValue("");
    try {
      await api.promoRemind(promoId, when.toISOString());
      toast.show(t("dashboard.promoRemindSet"), "success");
    } catch (e: any) {
      toast.show(
        e?.status === 422 ? t("dashboard.promoRemindErrPast") : t("dashboard.promoRemindErr"),
        "error",
      );
    }
  };

  const remindInHours = (hours: number) => {
    if (!remindPromoId) return;
    scheduleRemind(remindPromoId, new Date(Date.now() + hours * 3600 * 1000));
  };

  const remindTomorrowAt = (hour: number) => {
    if (!remindPromoId) return;
    const when = new Date();
    when.setDate(when.getDate() + 1);
    when.setHours(hour, 0, 0, 0);
    scheduleRemind(remindPromoId, when);
  };

  const remindCustomWeb = () => {
    if (!remindPromoId || !remindCustomValue) return;
    scheduleRemind(remindPromoId, new Date(remindCustomValue));
  };

  const shareSpending = async () => {
    const message = t("dashboard.shareMessage", {
      total: formatRupiah(data?.total_this_month || 0),
      count: data?.active_count || 0,
    });
    if (Platform.OS === "web") {
      const nav: any = typeof navigator !== "undefined" ? navigator : null;
      if (nav?.share) {
        try {
          await nav.share({ text: message });
          return;
        } catch {
          return;
        }
      }
      try {
        await nav?.clipboard?.writeText(message);
        toast.show(t("dashboard.shareCopied"), "success");
      } catch {
        toast.show(t("dashboard.shareFailed"), "error");
      }
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await Share.share({ message });
    } catch {}
  };

  const loadPromos = useCallback(async (plan?: string) => {
    if (plan !== "premium") return;
    setPromoLoading(true);
    try {
      const res: any = await api.promos();
      setPromos(res.promos || []);
    } catch {
      setPromos([]);
    } finally {
      setPromoLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res: any = await api.dashboard();
      setData(res);
      loadPromos(res?.plan);

      // "vs last month" — real tracked history, not a guess (see /analytics/spending).
      api
        .spendingHistory("monthly")
        .then((h: any) => {
          const points = h?.points || [];
          if (points.length >= 2) {
            setLastMonthTotal(points[points.length - 2].total);
          } else {
            setLastMonthTotal(null);
          }
        })
        .catch(() => setLastMonthTotal(null));

      // "Recently added" — the API already returns created_at per subscription,
      // it's just not surfaced by the plain upcoming/most-expensive lists.
      api
        .listSubs()
        .then((res: any) => {
          const list: SubWithMeta[] = res?.subscriptions || [];
          const sorted = [...list].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
          setRecentSubs(sorted.slice(0, 4));
        })
        .catch(() => setRecentSubs([]));
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadPromos]);

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
  const initials = (user?.name || "U")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const savingsFromTrials = useMemo(
    () => (data?.ending_trials || []).reduce((sum, tr) => sum + (tr.monthly_cost || 0), 0),
    [data?.ending_trials],
  );

  const categorySlices: DonutSlice[] = useMemo(
    () =>
      (data?.by_category || []).map((c) => {
        const cat = getCategory(c.category);
        return { key: c.category, label: t(`categories.${cat.key}`), value: c.total, color: cat.color };
      }),
    [data?.by_category, t],
  );
  const categoryGrandTotal = categorySlices.reduce((sum, s) => sum + s.value, 0) || 1;

  const filteredUpcoming = useMemo(() => {
    const list = data?.upcoming || [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.trim().toLowerCase();
    return list.filter((s) => s.name.toLowerCase().includes(q));
  }, [data?.upcoming, searchQuery]);

  const filteredRecent = useMemo(() => {
    if (!searchQuery.trim()) return recentSubs;
    const q = searchQuery.trim().toLowerCase();
    return recentSubs.filter((s) => s.name.toLowerCase().includes(q));
  }, [recentSubs, searchQuery]);

  const todayLong = new Date().toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }

  const isEmpty = !data || data.active_count === 0;
  const contentMaxWidth = isWide ? WIDE_CONTENT_MAX : MOBILE_CONTENT_MAX;

  return (
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: tabH + spacing.xl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        <View style={[styles.page, { maxWidth: contentMaxWidth }]}>
          {/* Header row */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greetingText}>
                {greeting()}, {firstName} 👋
              </Text>
              <Text style={styles.greetingSub}>{t("dashboard.greetingSubtitle")}</Text>
            </View>

            {isWide && (
              <View style={styles.searchBox} testID="dashboard-search">
                <MaterialCommunityIcons name="magnify" size={18} color={colors.muted} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={t("dashboard.searchPlaceholder")}
                  placeholderTextColor={colors.muted}
                  style={styles.searchInput}
                />
              </View>
            )}

            <View style={styles.headerRight}>
              <Pressable testID="dashboard-bell" onPress={() => router.push("/account")} style={styles.iconBtn} hitSlop={8}>
                <MaterialCommunityIcons name="bell-outline" size={20} color={colors.onSurface} />
              </Pressable>
              <Pressable testID="dashboard-avatar" onPress={() => router.push("/account")} style={styles.avatarBtn}>
                {user?.picture ? (
                  <Image source={{ uri: user.picture }} style={styles.avatarImg} contentFit="cover" />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarFallbackText}>{initials}</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>

          {isWide && (
            <View style={styles.dateRow}>
              <Text style={styles.dateText}>{todayLong}</Text>
              <Pressable
                testID="dashboard-add-sub"
                style={styles.addBtn}
                onPress={() => router.push("/subscription/form")}
              >
                <MaterialCommunityIcons name="plus" size={16} color="#fff" />
                <Text style={styles.addBtnText}>{t("dashboard.addButton")}</Text>
              </Pressable>
            </View>
          )}

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
              {/* Stat cards */}
              <View style={styles.statsRow}>
                <StatCard
                  icon="wallet-outline"
                  label={t("dashboard.totalLabel")}
                  value={formatRupiah(data?.total_this_month || 0)}
                  sub={
                    lastMonthTotal === null
                      ? undefined
                      : data!.total_this_month === lastMonthTotal
                        ? t("dashboard.statTotalDeltaFlat")
                        : data!.total_this_month > lastMonthTotal
                          ? t("dashboard.statTotalDeltaUp", {
                              value: formatRupiah(data!.total_this_month - lastMonthTotal),
                            })
                          : t("dashboard.statTotalDeltaDown", {
                              value: formatRupiah(lastMonthTotal - data!.total_this_month),
                            })
                  }
                  tint={colors.brand}
                  wide={isWide}
                  onPress={() => router.push("/spending-history")}
                />
                <StatCard
                  icon="calendar-clock-outline"
                  label={t("dashboard.statUpcomingLabel")}
                  value={t("dashboard.statUpcomingValue", { count: data?.upcoming.length || 0 })}
                  sub={t("dashboard.statUpcomingSub")}
                  tint="#0EA5E9"
                  wide={isWide}
                  onPress={() => router.push("/subscriptions")}
                />
                <StatCard
                  icon="leaf-circle-outline"
                  label={t("dashboard.statSavingsLabel")}
                  value={formatRupiah(savingsFromTrials)}
                  sub={savingsFromTrials > 0 ? t("dashboard.statSavingsSub") : t("dashboard.statSavingsSubEmpty")}
                  tint={colors.brandDark}
                  wide={isWide}
                />
                <StatCard
                  icon="view-grid-outline"
                  label={t("dashboard.statActiveLabel")}
                  value={String(data?.active_count || 0)}
                  sub={t("dashboard.statActiveSub", { count: data?.by_category.length || 0 })}
                  tint="#8B5CF6"
                  wide={isWide}
                  onPress={() => router.push("/subscriptions")}
                />
              </View>

              {/* Banners */}
              <View style={styles.bannersRow}>
                {!!data?.ending_trials?.length && (
                  <BannerCard
                    testID="banner-trials"
                    tone="danger"
                    icon="alert-circle-outline"
                    title={t("dashboard.bannerTrialTitle", { count: data.ending_trials.length })}
                    sub={t("dashboard.bannerTrialSub", { amount: formatRupiah(savingsFromTrials) })}
                    cta={t("dashboard.bannerTrialCta")}
                    wide={isWide}
                    onPress={() => router.push("/subscriptions")}
                  />
                )}
                <BannerCard
                  testID="banner-group"
                  tone="brand"
                  icon="account-group-outline"
                  title={t("dashboard.bannerGroupTitle")}
                  sub={t("dashboard.bannerGroupSub")}
                  cta={t("dashboard.bannerGroupCta")}
                  wide={isWide}
                  onPress={() => router.push("/groups")}
                />
                {data?.plan !== "premium" && (
                  <BannerCard
                    testID="banner-upgrade"
                    tone="amber"
                    icon="crown-outline"
                    title={t("dashboard.bannerUpgradeTitle")}
                    sub={t("dashboard.bannerUpgradeSub")}
                    cta={t("dashboard.bannerUpgradeCta")}
                    wide={isWide}
                    onPress={showUpgrade}
                  />
                )}
              </View>

              {/* 3-up grid */}
              <View style={[styles.gridRow, !isWide && styles.gridRowStack]}>
                <View style={styles.gridCol}>
                  <DashCard
                    title={t("dashboard.billsCardTitle")}
                    seeAllLabel={t("dashboard.seeAll")}
                    onSeeAll={() => router.push("/subscriptions")}
                  >
                    {filteredUpcoming.length > 0 ? (
                      <View style={{ gap: spacing.sm }}>
                        {filteredUpcoming.slice(0, 5).map((s) => {
                          const days = s.days_left ?? 0;
                          const tone = dueTone(days);
                          return (
                            <ListRow
                              key={s.id}
                              category={s.category}
                              name={s.name}
                              metaText={`${formatRupiah(s.price)} · ${t(`categories.${getCategory(s.category).key}`)}`}
                              rightBadgeText={dueLabelText(days, t)}
                              rightBadgeTone={tone}
                              onPress={() => router.push({ pathname: "/subscription/form", params: { id: s.id } })}
                            />
                          );
                        })}
                      </View>
                    ) : (
                      <Text style={styles.emptyRowText}>{t("dashboard.billsEmptyShort")}</Text>
                    )}
                  </DashCard>
                </View>

                <View style={styles.gridCol}>
                  <DashCard
                    title={t("dashboard.categoryCardTitle")}
                    extra={
                      <View style={styles.periodPill}>
                        <Text style={styles.periodPillText}>{t("dashboard.categoryPeriodLabel")}</Text>
                      </View>
                    }
                  >
                    {categorySlices.length > 0 ? (
                      <View style={{ alignItems: "center", gap: spacing.lg }}>
                        <DonutChart
                          slices={categorySlices}
                          centerValue={formatRupiah(categoryGrandTotal)}
                          centerLabel={t("dashboard.categoryTotalLabel")}
                        />
                        <View style={{ alignSelf: "stretch", gap: spacing.sm }}>
                          {categorySlices.map((s) => (
                            <View key={s.key} style={styles.legendRow}>
                              <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                              <Text style={styles.legendLabel} numberOfLines={1}>
                                {s.label}
                              </Text>
                              <Text style={styles.legendPct}>
                                {Math.round((s.value / categoryGrandTotal) * 100)}%
                              </Text>
                              <Text style={styles.legendValue}>{formatRupiah(s.value)}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : (
                      <Text style={styles.emptyRowText}>{t("dashboard.categoryEmpty")}</Text>
                    )}
                  </DashCard>
                </View>

                <View style={styles.gridCol}>
                  <DashCard
                    title={t("dashboard.recentCardTitle")}
                    seeAllLabel={t("dashboard.seeAll")}
                    onSeeAll={() => router.push("/subscriptions")}
                  >
                    {filteredRecent.length > 0 ? (
                      <View style={{ gap: spacing.sm }}>
                        {filteredRecent.map((s) => (
                          <ListRow
                            key={s.id}
                            category={s.category}
                            name={s.name}
                            metaText={`${formatRupiah(s.price)} · ${t(`cycles.${s.billing_cycle}`)}`}
                            rightText={addedLabelText(s.created_at, t)}
                            onPress={() => router.push({ pathname: "/subscription/form", params: { id: s.id } })}
                          />
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.emptyRowText}>{t("dashboard.recentEmpty")}</Text>
                    )}
                  </DashCard>
                </View>
              </View>

              {/* Recommendations */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t("dashboard.recommendSectionTitle")}</Text>
                <Text style={styles.sectionSub}>{t("dashboard.recommendSectionSub")}</Text>

                {data?.plan === "premium" ? (
                  promoLoading ? (
                    <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.lg }} />
                  ) : promos && promos.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.md }}
                    >
                      {promos.map((p) => (
                        <RecommendCard
                          key={p.id}
                          promo={p}
                          ctaLabel={t("dashboard.recommendCta")}
                          onJoin={() => openPromo(p.id)}
                          onRemind={() => setRemindPromoId(p.id)}
                        />
                      ))}
                    </ScrollView>
                  ) : (
                    <View style={styles.promoEmptyCard}>
                      <Text style={styles.promoEmptyTitle}>{t("dashboard.promoEmptyTitle")}</Text>
                      <Text style={styles.promoEmptySub}>{t("dashboard.promoEmptySubtitle")}</Text>
                    </View>
                  )
                ) : (
                  <Pressable testID="recommend-locked" onPress={showUpgrade} style={styles.promoLockedCard}>
                    <View style={styles.promoLockIconWrap}>
                      <MaterialCommunityIcons name="lock" size={18} color="#6B7280" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.promoLockedTitle}>{t("dashboard.recommendLockedTitle")}</Text>
                      <Text style={styles.promoLockedSub}>{t("dashboard.promoCardLockedSub")}</Text>
                    </View>
                    <View style={styles.promoUnlockPill}>
                      <MaterialCommunityIcons name="crown" size={11} color="#B45309" />
                      <Text style={styles.promoUnlockPillText}>{t("dashboard.promoCardUnlock")}</Text>
                    </View>
                  </Pressable>
                )}
              </View>

              <View style={{ height: spacing.md }} />
              <Pressable testID="share-spending-inline" onPress={shareSpending} style={styles.shareRow}>
                <MaterialCommunityIcons name="share-variant" size={15} color={colors.muted} />
                <Text style={styles.shareRowText}>{t("dashboard.shareCta")}</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>

      {/* Promo reminder time picker */}
      <Modal
        visible={!!remindPromoId}
        transparent
        animationType="fade"
        onRequestClose={() => setRemindPromoId(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setRemindPromoId(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{t("dashboard.promoRemindTitle")}</Text>
            <Text style={styles.modalSub}>{t("dashboard.promoRemindSub")}</Text>

            <Pressable testID="remind-1h" style={styles.remindOption} onPress={() => remindInHours(1)}>
              <MaterialCommunityIcons name="clock-outline" size={18} color={colors.brand} />
              <Text style={styles.remindOptionText}>{t("dashboard.promoRemind1h")}</Text>
            </Pressable>
            <Pressable testID="remind-3h" style={styles.remindOption} onPress={() => remindInHours(3)}>
              <MaterialCommunityIcons name="clock-outline" size={18} color={colors.brand} />
              <Text style={styles.remindOptionText}>{t("dashboard.promoRemind3h")}</Text>
            </Pressable>
            <Pressable testID="remind-6h" style={styles.remindOption} onPress={() => remindInHours(6)}>
              <MaterialCommunityIcons name="clock-outline" size={18} color={colors.brand} />
              <Text style={styles.remindOptionText}>{t("dashboard.promoRemind6h")}</Text>
            </Pressable>
            <Pressable
              testID="remind-tomorrow-morning"
              style={styles.remindOption}
              onPress={() => remindTomorrowAt(8)}
            >
              <MaterialCommunityIcons name="weather-sunset-up" size={18} color={colors.brand} />
              <Text style={styles.remindOptionText}>{t("dashboard.promoRemindTomorrowMorning")}</Text>
            </Pressable>
            <Pressable
              testID="remind-tomorrow-night"
              style={styles.remindOption}
              onPress={() => remindTomorrowAt(20)}
            >
              <MaterialCommunityIcons name="weather-night" size={18} color={colors.brand} />
              <Text style={styles.remindOptionText}>{t("dashboard.promoRemindTomorrowNight")}</Text>
            </Pressable>

            {Platform.OS === "web" ? (
              <View style={styles.remindCustomWebRow}>
                <MaterialCommunityIcons name="calendar-clock" size={18} color={colors.brand} />
                <input
                  data-testid="remind-custom-input"
                  type="datetime-local"
                  value={remindCustomValue}
                  min={toLocalDateTimeInput(new Date())}
                  onChange={(e) => setRemindCustomValue(e.target.value)}
                  style={webDateTimeInputStyle}
                />
                <Pressable
                  testID="remind-custom-go"
                  style={styles.remindCustomGo}
                  onPress={remindCustomWeb}
                >
                  <MaterialCommunityIcons name="check" size={18} color="#fff" />
                </Pressable>
              </View>
            ) : (
              <Pressable
                testID="remind-custom"
                style={styles.remindOption}
                onPress={() => {
                  setRemindNativeDate(new Date());
                  setRemindNativeStep("date");
                }}
              >
                <MaterialCommunityIcons name="calendar-clock" size={18} color={colors.brand} />
                <Text style={styles.remindOptionText}>{t("dashboard.promoRemindCustom")}</Text>
              </Pressable>
            )}

            <Pressable style={styles.cancelBtn} onPress={() => setRemindPromoId(null)}>
              <Text style={styles.cancelText}>{t("common.cancel")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {Platform.OS !== "web" && remindNativeStep === "date" && (
        <DateTimePicker
          value={remindNativeDate}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          minimumDate={new Date()}
          onChange={(event, date) => {
            setRemindNativeStep(null);
            if (event.type === "dismissed" || !date) return;
            setRemindNativeDate(date);
            setRemindNativeStep("time");
          }}
        />
      )}
      {Platform.OS !== "web" && remindNativeStep === "time" && (
        <DateTimePicker
          value={remindNativeDate}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, time) => {
            setRemindNativeStep(null);
            if (event.type === "dismissed" || !time || !remindPromoId) return;
            const combined = new Date(remindNativeDate);
            combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
            scheduleRemind(remindPromoId, combined);
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  page: { width: "100%", alignSelf: "center", paddingHorizontal: spacing.xl },

  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginBottom: spacing.md },
  greetingText: { fontFamily: font.extrabold, fontSize: fontSize["2xl"], color: colors.onSurface },
  greetingSub: { fontFamily: font.medium, fontSize: fontSize.sm, color: colors.muted, marginTop: 2 },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
    maxWidth: 380,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    height: 42,
  },
  searchInput: { flex: 1, fontFamily: font.medium, fontSize: fontSize.base, color: colors.onSurface, outlineWidth: 0 } as any,

  headerRight: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBtn: { width: 38, height: 38 },
  avatarImg: { width: 38, height: 38, borderRadius: radius.pill },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: { fontFamily: font.extrabold, fontSize: fontSize.sm, color: colors.onBrandSecondary },

  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  dateText: { fontFamily: font.medium, fontSize: fontSize.sm, color: colors.muted },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    ...shadow.soft,
  },
  addBtnText: { fontFamily: font.bold, fontSize: fontSize.sm, color: "#fff" },

  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.sm },
  statCard: {
    minWidth: 150,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.soft,
  },
  statTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statLabel: { flex: 1, fontFamily: font.semibold, fontSize: 12, color: colors.muted, marginRight: spacing.sm },
  statIconWrap: { width: 26, height: 26, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  statValue: { fontFamily: font.extrabold, fontSize: fontSize.xl, color: colors.onSurface, marginTop: spacing.sm },
  statSub: { fontFamily: font.medium, fontSize: 11, color: colors.muted, marginTop: 3 },

  bannersRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.lg },
  bannerCard: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, gap: 4 },
  bannerTitle: { fontFamily: font.bold, fontSize: fontSize.base, marginTop: spacing.xs },
  bannerSub: { fontFamily: font.regular, fontSize: fontSize.sm, lineHeight: 18 },
  bannerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  bannerBtnText: { fontFamily: font.bold, fontSize: fontSize.sm },

  gridRow: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.xl, alignItems: "flex-start" },
  gridRowStack: { flexDirection: "column" },
  gridCol: { flex: 1, minWidth: 0, width: "100%" },

  dashCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, ...shadow.soft },
  dashCardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  dashCardTitle: { flex: 1, fontFamily: font.bold, fontSize: fontSize.lg, color: colors.onSurface },
  dashCardSeeAll: { fontFamily: font.semibold, fontSize: 12, color: colors.brand },
  emptyRowText: { fontFamily: font.medium, fontSize: fontSize.sm, color: colors.muted, textAlign: "center", paddingVertical: spacing.lg },

  periodPill: { backgroundColor: colors.surfaceTertiary, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  periodPillText: { fontFamily: font.semibold, fontSize: 11, color: colors.onSurfaceTertiary },

  legendRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { flex: 1, fontFamily: font.semibold, fontSize: fontSize.sm, color: colors.onSurface },
  legendPct: { fontFamily: font.medium, fontSize: 11, color: colors.muted, marginRight: spacing.sm },
  legendValue: { fontFamily: font.bold, fontSize: fontSize.sm, color: colors.onSurface },

  listRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  listRowName: { fontFamily: font.bold, fontSize: fontSize.base, color: colors.onSurface },
  listRowMeta: { fontFamily: font.medium, fontSize: 12, color: colors.muted, marginTop: 1 },
  listRowBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  listRowBadgeText: { fontFamily: font.bold, fontSize: 11 },
  listRowRightText: { fontFamily: font.medium, fontSize: 11, color: colors.muted, maxWidth: 90, textAlign: "right" },

  section: { marginTop: spacing.xl },
  sectionTitle: { fontFamily: font.bold, fontSize: fontSize.lg, color: colors.onSurface },
  sectionSub: { fontFamily: font.medium, fontSize: fontSize.sm, color: colors.muted, marginTop: 2 },

  recommendCard: {
    width: 220,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.soft,
  },
  recommendIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  recommendTitle: { fontFamily: font.bold, fontSize: fontSize.base, color: colors.onSurface },
  recommendApp: { fontFamily: font.medium, fontSize: 11, color: colors.muted, marginTop: 1 },
  recommendDesc: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginTop: spacing.sm, lineHeight: 17, minHeight: 51 },
  recommendActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  recommendCta: {
    flex: 1,
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  recommendCtaText: { fontFamily: font.bold, fontSize: 12, color: "#fff" },
  recommendRemindBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },

  promoEmptyCard: { alignItems: "center", paddingVertical: spacing.xl },
  promoEmptyTitle: { fontFamily: font.bold, fontSize: fontSize.base, color: colors.onSurface },
  promoEmptySub: { fontFamily: font.regular, fontSize: fontSize.sm, color: colors.muted, marginTop: 2, textAlign: "center" },

  promoLockedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
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

  shareRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: spacing.md },
  shareRowText: { fontFamily: font.semibold, fontSize: 12, color: colors.muted },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(24,41,36,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  modalTitle: { fontFamily: font.extrabold, fontSize: fontSize.xl, color: colors.onSurface },
  modalSub: {
    fontFamily: font.regular,
    fontSize: fontSize.base,
    color: colors.muted,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  cancelBtn: { alignItems: "center", paddingVertical: spacing.md, marginTop: spacing.sm },
  cancelText: { fontFamily: font.semibold, fontSize: fontSize.base, color: colors.muted },
  remindOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceTertiary,
  },
  remindOptionText: { fontFamily: font.semibold, fontSize: fontSize.base, color: colors.onSurface },
  remindCustomWebRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  remindCustomGo: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
});
