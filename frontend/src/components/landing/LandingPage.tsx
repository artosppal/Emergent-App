import React, { useRef } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Button } from "@/src/components/ui";
import { useLanguage } from "@/src/context/LanguageContext";
import { colors, font, fontSize, radius, spacing, shadow } from "@/src/theme";

const MAX_WIDTH = 1120;

export function LandingPage() {
  const router = useRouter();
  const { t, language, toggleLanguage } = useLanguage();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const isTablet = width >= 640;

  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});

  const registerSection = (key: string) => (e: any) => {
    sectionY.current[key] = e.nativeEvent.layout.y;
  };
  const scrollToSection = (key: string) => {
    const y = sectionY.current[key];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
  };

  const goRegister = () => router.push("/(auth)/login?mode=register");
  const goLogin = () => router.push("/(auth)/login");

  return (
    <View style={styles.root}>
      <Nav
        isWide={isWide}
        language={language}
        onToggleLanguage={toggleLanguage}
        onNavPress={scrollToSection}
        onLogin={goLogin}
        onSignup={goRegister}
        t={t}
      />
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing["3xl"] }}
        showsVerticalScrollIndicator={false}
      >
        <Hero isWide={isWide} onSignup={goRegister} onLogin={goLogin} t={t} />

        <View onLayout={registerSection("features")}>
          <Features isWide={isWide} t={t} />
        </View>

        <View onLayout={registerSection("how")}>
          <HowItWorks isWide={isWide} t={t} />
        </View>

        <View onLayout={registerSection("pricing")}>
          <Pricing isTablet={isTablet} onSignup={goRegister} t={t} />
        </View>

        <FinalCta onSignup={goRegister} t={t} />

        <Footer isTablet={isTablet} router={router} t={t} />
      </ScrollView>
    </View>
  );
}

// ---------------- Nav ----------------
function Nav({ isWide, language, onToggleLanguage, onNavPress, onLogin, onSignup, t }: any) {
  return (
    <View style={styles.navBar}>
      <View style={styles.navInner}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <MaterialCommunityIcons name="bell-ring" size={20} color={colors.onBrandPrimary} />
          </View>
          <Text style={styles.brandName}>Notifin</Text>
        </View>

        {isWide && (
          <View style={styles.navLinks}>
            <Pressable onPress={() => onNavPress("features")}>
              <Text style={styles.navLink}>{t("landing.navFeatures")}</Text>
            </Pressable>
            <Pressable onPress={() => onNavPress("how")}>
              <Text style={styles.navLink}>{t("landing.navHow")}</Text>
            </Pressable>
            <Pressable onPress={() => onNavPress("pricing")}>
              <Text style={styles.navLink}>{t("landing.navPricing")}</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.navActions}>
          <Pressable onPress={onToggleLanguage} style={styles.langPill} testID="landing-lang-toggle">
            <Text style={styles.langPillText}>{language.toUpperCase()}</Text>
          </Pressable>
          {isWide && (
            <Pressable onPress={onLogin} style={styles.navLoginBtn} testID="landing-nav-login">
              <Text style={styles.navLoginText}>{t("landing.navLogin")}</Text>
            </Pressable>
          )}
          <Pressable onPress={onSignup} style={styles.navSignupBtn} testID="landing-nav-signup">
            <Text style={styles.navSignupText}>{t("landing.navSignup")}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ---------------- Hero ----------------
function Hero({ isWide, onSignup, onLogin, t }: any) {
  return (
    <View style={[styles.section, { paddingTop: spacing["3xl"] }]}>
      <View style={[styles.heroLayout, isWide && styles.heroLayoutWide]}>
        <View style={[styles.heroText, isWide && { maxWidth: 520 }]}>
          <View style={styles.eyebrow}>
            <MaterialCommunityIcons name="bell-ring-outline" size={14} color={colors.brandDark} />
            <Text style={styles.eyebrowText}>{t("landing.heroEyebrow")}</Text>
          </View>

          <Text style={[styles.heroTitle, isWide && styles.heroTitleWide]}>
            {t("landing.heroTitlePart1")}
            <Text style={{ color: colors.brand }}>{t("landing.heroTitleHighlight")}</Text>
            {t("landing.heroTitlePart2")}
          </Text>

          <Text style={styles.heroSubtitle}>{t("landing.heroSubtitle")}</Text>

          <View style={styles.heroCtaRow}>
            <Button title={t("landing.heroCtaPrimary")} onPress={onSignup} testID="landing-hero-signup" />
            <Button
              title={t("landing.heroCtaSecondary")}
              onPress={onLogin}
              variant="secondary"
              testID="landing-hero-login"
            />
          </View>

          <View style={styles.heroTrustRow}>
            <MaterialCommunityIcons name="check-decagram" size={16} color={colors.brand} />
            <Text style={styles.heroTrustText}>{t("landing.heroTrust")}</Text>
          </View>
        </View>

        <View style={[styles.heroVisualWrap, isWide && { marginTop: 0 }]}>
          <DashboardMock t={t} />
        </View>
      </View>
    </View>
  );
}

function DashboardMock({ t }: any) {
  const items = [
    { name: t("landing.mockItem1Name"), due: t("landing.mockItem1Due"), color: "#EF4444" },
    { name: t("landing.mockItem2Name"), due: t("landing.mockItem2Due"), color: colors.warning },
    { name: t("landing.mockItem3Name"), due: t("landing.mockItem3Due"), color: colors.brand },
  ];
  return (
    <View style={styles.mockCard}>
      <Text style={styles.mockCardTitle}>{t("landing.mockCardTitle")}</Text>
      {items.map((it) => (
        <View key={it.name} style={styles.mockRow}>
          <View style={styles.mockRowLeft}>
            <View style={[styles.mockDot, { backgroundColor: it.color }]} />
            <Text style={styles.mockItemName}>{it.name}</Text>
          </View>
          <View style={[styles.mockDuePill, { backgroundColor: it.color + "1A" }]}>
            <Text style={[styles.mockDueText, { color: it.color }]}>{it.due}</Text>
          </View>
        </View>
      ))}
      <View style={styles.mockDivider} />
      <View style={styles.mockRow}>
        <Text style={styles.mockTotalLabel}>{t("landing.mockTotalLabel")}</Text>
        <Text style={styles.mockTotalValue}>Rp487.000</Text>
      </View>
    </View>
  );
}

// ---------------- Features ----------------
function Features({ isWide, t }: any) {
  const items = [
    { icon: "bell-ring", title: t("landing.feature1Title"), body: t("landing.feature1Body") },
    { icon: "view-dashboard", title: t("landing.feature2Title"), body: t("landing.feature2Body") },
    { icon: "account-group", title: t("landing.feature3Title"), body: t("landing.feature3Body") },
  ];
  return (
    <View style={styles.sectionOuterAlt}>
      <View style={styles.sectionInner}>
        <SectionHeading eyebrow={t("landing.featuresEyebrow")} title={t("landing.featuresTitle")} />
        <View style={[styles.cardGrid, isWide && styles.cardGridWide]}>
          {items.map((it) => (
            <View key={it.title} style={[styles.featureCard, isWide && styles.featureCardWide]}>
              <View style={styles.featureIcon}>
                <MaterialCommunityIcons name={it.icon as any} size={26} color={colors.brand} />
              </View>
              <Text style={styles.featureTitle}>{it.title}</Text>
              <Text style={styles.featureBody}>{it.body}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ---------------- How it works ----------------
function HowItWorks({ isWide, t }: any) {
  const steps = [
    { title: t("landing.how1Title"), body: t("landing.how1Body") },
    { title: t("landing.how2Title"), body: t("landing.how2Body") },
    { title: t("landing.how3Title"), body: t("landing.how3Body") },
  ];
  return (
    <View style={styles.section}>
      <SectionHeading eyebrow={t("landing.howEyebrow")} title={t("landing.howTitle")} />
      <View style={[styles.cardGrid, isWide && styles.cardGridWide]}>
        {steps.map((s, i) => (
          <View key={s.title} style={[styles.stepCard, isWide && styles.featureCardWide]}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{i + 1}</Text>
            </View>
            <Text style={styles.featureTitle}>{s.title}</Text>
            <Text style={styles.featureBody}>{s.body}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ---------------- Pricing ----------------
function Pricing({ isTablet, onSignup, t }: any) {
  const freeItems = [t("landing.pricingFreeItem1"), t("landing.pricingFreeItem2"), t("landing.pricingFreeItem3")];
  const premiumItems = [
    t("landing.pricingPremiumItem1"),
    t("landing.pricingPremiumItem2"),
    t("landing.pricingPremiumItem3"),
  ];
  return (
    <View style={styles.sectionOuterAlt}>
      <View style={styles.sectionInner}>
        <SectionHeading eyebrow={t("landing.pricingEyebrow")} title={t("landing.pricingTitle")} />
        <View style={[styles.pricingRow, isTablet && styles.pricingRowWide]}>
          <View style={styles.pricingCard}>
            <Text style={styles.pricingPlanTitle}>{t("landing.pricingFreeTitle")}</Text>
            {freeItems.map((it) => (
              <PricingItem key={it} label={it} />
            ))}
          </View>

          <View style={[styles.pricingCard, styles.pricingCardHighlight]}>
            <View style={styles.pricingBadge}>
              <Text style={styles.pricingBadgeText}>{t("landing.pricingPremiumBadge")}</Text>
            </View>
            <Text style={[styles.pricingPlanTitle, { color: colors.onBrandPrimary }]}>
              {t("landing.pricingPremiumTitle")}
            </Text>
            {premiumItems.map((it) => (
              <PricingItem key={it} label={it} inverted />
            ))}
            <Button
              title={t("landing.pricingCta")}
              onPress={onSignup}
              variant="secondary"
              style={{ backgroundColor: "#FFFFFF", marginTop: spacing.lg }}
              testID="landing-pricing-signup"
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function PricingItem({ label, inverted }: { label: string; inverted?: boolean }) {
  return (
    <View style={styles.pricingItemRow}>
      <MaterialCommunityIcons
        name="check-circle"
        size={18}
        color={inverted ? "#FFFFFF" : colors.brand}
      />
      <Text style={[styles.pricingItemText, inverted && { color: "#FFFFFF" }]}>{label}</Text>
    </View>
  );
}

// ---------------- Final CTA ----------------
function FinalCta({ onSignup, t }: any) {
  return (
    <View style={styles.section}>
      <View style={styles.ctaBanner}>
        <Text style={styles.ctaTitle}>{t("landing.ctaTitle")}</Text>
        <Text style={styles.ctaSubtitle}>{t("landing.ctaSubtitle")}</Text>
        <Button
          title={t("landing.ctaButton")}
          onPress={onSignup}
          variant="secondary"
          style={{ backgroundColor: "#FFFFFF", marginTop: spacing.lg }}
          testID="landing-final-signup"
        />
      </View>
    </View>
  );
}

// ---------------- Footer ----------------
function Footer({ isTablet, router, t }: any) {
  return (
    <View style={styles.section}>
      <View style={[styles.footerRow, isTablet && styles.footerRowWide]}>
        <View style={{ maxWidth: 320 }}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <MaterialCommunityIcons name="bell-ring" size={18} color={colors.onBrandPrimary} />
            </View>
            <Text style={styles.brandName}>Notifin</Text>
          </View>
          <Text style={styles.footerTagline}>{t("landing.footerTagline")}</Text>
        </View>

        <View style={styles.footerLinks}>
          <Pressable onPress={() => router.push("/privacy")}>
            <Text style={styles.footerLink}>{t("landing.footerPrivacy")}</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/terms")}>
            <Text style={styles.footerLink}>{t("landing.footerTerms")}</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.footerCopyright}>
        © {new Date().getFullYear()} Notifin. {t("landing.footerRights")}
      </Text>
    </View>
  );
}

// ---------------- Shared ----------------
function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View style={styles.headingWrap}>
      <Text style={styles.headingEyebrow}>{eyebrow}</Text>
      <Text style={styles.headingTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },

  navBar: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  navInner: {
    width: "100%",
    maxWidth: MAX_WIDTH,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: { fontFamily: font.extrabold, fontSize: fontSize.lg, color: colors.onSurface },

  navLinks: { flexDirection: "row", alignItems: "center", gap: spacing.xl },
  navLink: { fontFamily: font.semibold, fontSize: fontSize.base, color: colors.onSurfaceSecondary },

  navActions: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  langPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
  },
  langPillText: { fontFamily: font.bold, fontSize: fontSize.sm, color: colors.onSurfaceTertiary },
  navLoginBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  navLoginText: { fontFamily: font.semibold, fontSize: fontSize.base, color: colors.onSurface },
  navSignupBtn: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
  },
  navSignupText: { fontFamily: font.bold, fontSize: fontSize.base, color: colors.onBrandPrimary },

  section: {
    width: "100%",
    maxWidth: MAX_WIDTH,
    alignSelf: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing["3xl"],
  },
  sectionOuterAlt: { width: "100%", backgroundColor: colors.surfaceTertiary },
  sectionInner: {
    width: "100%",
    maxWidth: MAX_WIDTH,
    alignSelf: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing["3xl"],
  },

  heroLayout: { flexDirection: "column", alignItems: "center" },
  heroLayoutWide: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing["3xl"] },
  heroText: { alignItems: "flex-start" },
  eyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    marginBottom: spacing.lg,
  },
  eyebrowText: { fontFamily: font.bold, fontSize: fontSize.sm, color: colors.brandDark, letterSpacing: 0.5 },
  heroTitle: {
    fontFamily: font.extrabold,
    fontSize: 38,
    lineHeight: 44,
    color: colors.onSurface,
  },
  heroTitleWide: { fontSize: 48, lineHeight: 54 },
  heroSubtitle: {
    fontFamily: font.medium,
    fontSize: fontSize.lg,
    lineHeight: 24,
    color: colors.muted,
    marginTop: spacing.lg,
    maxWidth: 460,
  },
  heroCtaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.xl },
  heroTrustRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.lg },
  heroTrustText: { fontFamily: font.medium, fontSize: fontSize.sm, color: colors.muted },

  heroVisualWrap: { marginTop: spacing["3xl"], width: "100%", maxWidth: 360, alignItems: "center" },
  mockCard: {
    width: "100%",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadow.card,
  },
  mockCardTitle: { fontFamily: font.bold, fontSize: fontSize.lg, color: colors.onSurface, marginBottom: spacing.lg },
  mockRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  mockRowLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  mockDot: { width: 10, height: 10, borderRadius: 5 },
  mockItemName: { fontFamily: font.semibold, fontSize: fontSize.base, color: colors.onSurface },
  mockDuePill: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  mockDueText: { fontFamily: font.bold, fontSize: fontSize.sm },
  mockDivider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.md },
  mockTotalLabel: { fontFamily: font.semibold, fontSize: fontSize.base, color: colors.muted },
  mockTotalValue: { fontFamily: font.extrabold, fontSize: fontSize.xl, color: colors.brand },

  headingWrap: { alignItems: "center", marginBottom: spacing["2xl"] },
  headingEyebrow: {
    fontFamily: font.bold,
    fontSize: fontSize.sm,
    color: colors.brand,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  headingTitle: {
    fontFamily: font.extrabold,
    fontSize: fontSize["2xl"],
    color: colors.onSurface,
    textAlign: "center",
    maxWidth: 520,
  },

  cardGrid: { flexDirection: "column", gap: spacing.lg },
  cardGridWide: { flexDirection: "row", gap: spacing.xl },
  featureCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadow.soft,
  },
  featureCardWide: { flex: 1 },
  featureIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  featureTitle: { fontFamily: font.bold, fontSize: fontSize.lg, color: colors.onSurface, marginBottom: spacing.xs },
  featureBody: { fontFamily: font.regular, fontSize: fontSize.base, color: colors.muted, lineHeight: 21 },

  stepCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  stepNumberText: { fontFamily: font.extrabold, fontSize: fontSize.lg, color: colors.onBrandPrimary },

  pricingRow: { flexDirection: "column", gap: spacing.lg },
  pricingRowWide: { flexDirection: "row" },
  pricingCard: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pricingCardHighlight: { backgroundColor: colors.brand, borderColor: colors.brand },
  pricingBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
  },
  pricingBadgeText: { fontFamily: font.bold, fontSize: fontSize.sm, color: "#FFFFFF" },
  pricingPlanTitle: { fontFamily: font.extrabold, fontSize: fontSize.xl, color: colors.onSurface, marginBottom: spacing.lg },
  pricingItemRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  pricingItemText: { fontFamily: font.medium, fontSize: fontSize.base, color: colors.onSurface },

  ctaBanner: {
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    padding: spacing["3xl"],
    alignItems: "center",
  },
  ctaTitle: {
    fontFamily: font.extrabold,
    fontSize: fontSize["2xl"],
    color: "#FFFFFF",
    textAlign: "center",
  },
  ctaSubtitle: {
    fontFamily: font.medium,
    fontSize: fontSize.base,
    color: "rgba(255,255,255,0.9)",
    marginTop: spacing.sm,
    textAlign: "center",
  },

  footerRow: { flexDirection: "column", gap: spacing.xl },
  footerRowWide: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  footerTagline: { fontFamily: font.regular, fontSize: fontSize.sm, color: colors.muted, marginTop: spacing.md, lineHeight: 19 },
  footerLinks: { flexDirection: "row", gap: spacing.xl },
  footerLink: { fontFamily: font.semibold, fontSize: fontSize.base, color: colors.onSurfaceSecondary },
  footerCopyright: {
    fontFamily: font.regular,
    fontSize: fontSize.sm,
    color: colors.muted,
    marginTop: spacing["2xl"],
    textAlign: "center",
  },
});
