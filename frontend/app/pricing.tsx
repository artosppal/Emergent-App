import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Button } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useUpgrade } from "@/src/context/UpgradeContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { colors, font, fontSize, radius, spacing } from "@/src/theme";
import { Nav, Footer, SectionHeading, sharedStyles } from "@/src/components/landing/shared";
import { Pricing } from "@/src/components/landing/LandingPage";

// Standalone, directly-linkable pricing page. Doubles as marketing content
// for logged-out visitors (full Nav/Footer chrome, matches the landing
// page's look) and as an in-app "compare plans" page for logged-in users
// (simple back header instead — reached from Account's "Bandingkan semua
// fitur paket" link), with the CTA on each card adapting to what the
// visitor can actually do: register, open the upgrade sheet, or nothing
// (already on that plan).
export default function PricingPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showUpgrade } = useUpgrade();
  const { t, language, toggleLanguage } = useLanguage();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const isTablet = width >= 640;

  const isPremium = user?.plan === "premium";
  const goRegister = () => router.push("/(auth)/login?mode=register");
  const goLogin = () => router.push("/(auth)/login");
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/account"));

  // "Fitur"/"Cara Kerja" live on the landing page, not here — send visitors
  // there. "Harga" is this page, so it's a no-op.
  const onNavPress = (key: string) => {
    if (key !== "pricing") router.push("/");
  };

  const comparisonRows: { label: string; free: string | boolean; premium: string | boolean }[] = [
    { label: t("pricingPage.rowSubs"), free: t("pricingPage.rowSubsFree"), premium: t("pricingPage.rowSubsPremium") },
    { label: t("pricingPage.rowPush"), free: true, premium: true },
    { label: t("pricingPage.rowDashboard"), free: true, premium: true },
    { label: t("pricingPage.rowWa"), free: t("pricingPage.rowWaFree"), premium: t("pricingPage.rowWaPremium") },
    { label: t("pricingPage.rowCreateGroup"), free: false, premium: true },
    { label: t("pricingPage.rowJoinGroup"), free: true, premium: true },
    { label: t("pricingPage.rowPromo"), free: false, premium: true },
    { label: t("pricingPage.rowSummary"), free: false, premium: true },
  ];

  const faqItems = [1, 2, 3, 4, 5].map((i) => ({
    q: t(`pricingPage.faq${i}Q`),
    a: t(`pricingPage.faq${i}A`),
  }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {user ? (
        <View style={[styles.inAppHeader, { paddingTop: insets.top + spacing.md }]}>
          <Pressable onPress={goBack} testID="pricing-back">
            <Text style={styles.backLink}>{"< " + t("pricingPage.backLink")}</Text>
          </Pressable>
        </View>
      ) : (
        <Nav
          isWide={isWide}
          language={language}
          onToggleLanguage={toggleLanguage}
          onNavPress={onNavPress}
          onLogin={goLogin}
          onSignup={goRegister}
          t={t}
        />
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: spacing["3xl"] }} showsVerticalScrollIndicator={false}>
        <View style={sharedStyles.section}>
          <View style={styles.hero}>
            <View style={styles.eyebrowPill}>
              <Text style={styles.eyebrowText}>{t("pricingPage.eyebrow")}</Text>
            </View>
            <Text style={styles.heroTitle}>{t("pricingPage.title")}</Text>
            <Text style={styles.heroSubtitle}>{t("pricingPage.subtitle")}</Text>
          </View>
        </View>

        <Pricing
          isTablet={isTablet}
          onSignup={goRegister}
          onFreePress={goRegister}
          onPremiumPress={user ? showUpgrade : goRegister}
          freeActive={!!user && !isPremium}
          premiumActive={isPremium}
          t={t}
        />

        <View style={sharedStyles.section}>
          <SectionHeading eyebrow={t("pricingPage.compareEyebrow")} title={t("pricingPage.compareTitle")} />
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeaderRow]}>
              <Text style={[styles.tableCellLabel, styles.tableHeaderText]}>{t("pricingPage.colFeature")}</Text>
              <Text style={[styles.tableCellCol, styles.tableHeaderText]}>{t("pricingPage.colFree")}</Text>
              <Text style={[styles.tableCellCol, styles.tableHeaderText, { color: colors.brand }]}>
                {t("pricingPage.colPremium")}
              </Text>
            </View>
            {comparisonRows.map((row) => (
              <View key={row.label} style={styles.tableRow}>
                <Text style={styles.tableCellLabel}>{row.label}</Text>
                <View style={styles.tableCellCol}>
                  <TableValue value={row.free} />
                </View>
                <View style={styles.tableCellCol}>
                  <TableValue value={row.premium} />
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={sharedStyles.sectionOuterAlt}>
          <View style={sharedStyles.sectionInner}>
            <SectionHeading eyebrow={t("pricingPage.faqEyebrow")} title={t("pricingPage.faqTitle")} />
            <View style={styles.faqList}>
              {faqItems.map((item) => (
                <View key={item.q} style={styles.faqItem}>
                  <Text style={styles.faqQ}>{item.q}</Text>
                  <Text style={styles.faqA}>{item.a}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {!isPremium && (
          <View style={sharedStyles.section}>
            <View style={styles.ctaBanner}>
              <Text style={styles.ctaTitle}>{t("pricingPage.ctaTitle")}</Text>
              <Text style={styles.ctaSubtitle}>
                {user ? t("pricingPage.ctaSubtitleFree") : t("pricingPage.ctaSubtitleLoggedOut")}
              </Text>
              <Button
                title={t("landing.pricingPremiumCta")}
                onPress={user ? showUpgrade : goRegister}
                variant="secondary"
                style={{ backgroundColor: "#FFFFFF", marginTop: spacing.lg }}
                testID="pricing-final-cta"
              />
            </View>
          </View>
        )}

        <Footer isTablet={isTablet} router={router} t={t} />
      </ScrollView>
    </View>
  );
}

function TableValue({ value }: { value: string | boolean }) {
  if (typeof value === "string") {
    return <Text style={styles.tableValueText}>{value}</Text>;
  }
  return value ? (
    <MaterialCommunityIcons name="check-circle" size={20} color={colors.brand} />
  ) : (
    <MaterialCommunityIcons name="close-circle-outline" size={20} color={colors.muted} />
  );
}

const styles = StyleSheet.create({
  inAppHeader: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backLink: { fontFamily: font.semibold, fontSize: fontSize.base, color: colors.brand },

  hero: { alignItems: "center", paddingTop: spacing.lg },
  eyebrowPill: {
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    marginBottom: spacing.lg,
  },
  eyebrowText: { fontFamily: font.bold, fontSize: fontSize.sm, color: colors.brandDark, letterSpacing: 0.5 },
  heroTitle: {
    fontFamily: font.extrabold,
    fontSize: 34,
    lineHeight: 40,
    color: colors.onSurface,
    textAlign: "center",
    maxWidth: 620,
  },
  heroSubtitle: {
    fontFamily: font.medium,
    fontSize: fontSize.lg,
    lineHeight: 24,
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.md,
    maxWidth: 480,
  },

  table: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tableHeaderRow: { borderTopWidth: 0, backgroundColor: colors.surfaceTertiary },
  tableHeaderText: { fontFamily: font.bold, fontSize: fontSize.sm, color: colors.onSurface },
  tableCellLabel: { flex: 1, fontFamily: font.medium, fontSize: fontSize.base, color: colors.onSurface, paddingRight: spacing.sm },
  tableCellCol: { width: 84, alignItems: "center", justifyContent: "center" },
  tableValueText: { fontFamily: font.semibold, fontSize: fontSize.sm, color: colors.onSurface, textAlign: "center" },

  faqList: { gap: spacing.lg },
  faqItem: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  faqQ: { fontFamily: font.bold, fontSize: fontSize.lg, color: colors.onSurface, marginBottom: spacing.xs },
  faqA: { fontFamily: font.regular, fontSize: fontSize.base, color: colors.muted, lineHeight: 21 },

  ctaBanner: {
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    padding: spacing["3xl"],
    alignItems: "center",
  },
  ctaTitle: { fontFamily: font.extrabold, fontSize: fontSize["2xl"], color: "#FFFFFF", textAlign: "center" },
  ctaSubtitle: {
    fontFamily: font.medium,
    fontSize: fontSize.base,
    color: "rgba(255,255,255,0.9)",
    marginTop: spacing.sm,
    textAlign: "center",
  },
});
