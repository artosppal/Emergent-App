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
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Button } from "@/src/components/ui";
import { useLanguage } from "@/src/context/LanguageContext";
import { colors, font, fontSize, radius, spacing, shadow } from "@/src/theme";
import { Nav, SectionHeading, Footer, sharedStyles } from "@/src/components/landing/shared";

// Real product mockup, user-owned/generated asset — see hero visual below.
const HERO_MOCKUP = require("@/assets/images/hero-mockup.jpg");
const HERO_MOCKUP_RATIO = 921 / 665;

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
        onFaq={() => router.push("/faq")}
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

        <TrustBar isWide={isWide} t={t} />

        <ProblemSection isWide={isWide} t={t} />

        <View onLayout={registerSection("how")}>
          <HowItWorks isWide={isWide} t={t} />
        </View>

        <View onLayout={registerSection("features")}>
          <Features isWide={isWide} t={t} />
        </View>

        <DashboardPreview isWide={isWide} t={t} onSignup={goRegister} />

        <View onLayout={registerSection("pricing")}>
          <Pricing isTablet={isTablet} onSignup={goRegister} t={t} />
        </View>

        <FinalCta onSignup={goRegister} t={t} />

        <Footer isTablet={isTablet} router={router} t={t} />
      </ScrollView>
    </View>
  );
}

// ---------------- Hero ----------------
function Hero({ isWide, onSignup, onLogin, t }: any) {
  return (
    <View style={[sharedStyles.section, { paddingTop: spacing["3xl"] }]}>
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

        <View style={[styles.heroVisualWrap, isWide && styles.heroVisualWrapWide]}>
          <Image
            source={HERO_MOCKUP}
            style={[styles.heroMockupImage, { aspectRatio: HERO_MOCKUP_RATIO }]}
            contentFit="contain"
            accessibilityLabel={t("landing.heroMockupAlt")}
          />
        </View>
      </View>
    </View>
  );
}

// ---------------- Trust bar ----------------
// Honest social-proof substitute: we don't have real testimonials yet, and
// won't fabricate quotes from fictional users, so this leads with concrete,
// verifiable trust signals instead (no card required, real payment
// processor, no lock-in).
function TrustBar({ isWide, t }: any) {
  const items = [
    { icon: "credit-card-off-outline", text: t("landing.trust1") },
    { icon: "shield-lock-outline", text: t("landing.trust2") },
    { icon: "close-circle-outline", text: t("landing.trust3") },
  ];
  return (
    <View style={styles.trustBar}>
      <View style={[styles.trustBarInner, isWide && styles.trustBarInnerWide]}>
        {items.map((it) => (
          <View key={it.text} style={styles.trustBarItem}>
            <MaterialCommunityIcons name={it.icon as any} size={18} color={colors.brand} />
            <Text style={styles.trustBarText}>{it.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ---------------- Problem / Pain (#02) ----------------
function ProblemSection({ isWide, t }: any) {
  const items = [
    { icon: "format-list-numbered", title: t("landing.pain1Title"), body: t("landing.pain1Body") },
    { icon: "calendar-remove-outline", title: t("landing.pain2Title"), body: t("landing.pain2Body") },
    { icon: "wallet-outline", title: t("landing.pain3Title"), body: t("landing.pain3Body") },
    { icon: "sleep", title: t("landing.pain4Title"), body: t("landing.pain4Body") },
    { icon: "help-circle-outline", title: t("landing.pain5Title"), body: t("landing.pain5Body") },
  ];
  return (
    <View style={sharedStyles.section}>
      <SectionHeading eyebrow={t("landing.painEyebrow")} title={t("landing.painTitle")} />
      <Text style={styles.problemSubtitle}>{t("landing.painSubtitle")}</Text>
      <View style={[styles.painGrid, isWide && styles.painGridWide]}>
        {items.map((it) => (
          <View key={it.title} style={[styles.featureCard, isWide && styles.painCardWide]}>
            <View style={styles.featureIcon}>
              <MaterialCommunityIcons name={it.icon as any} size={26} color={colors.brand} />
            </View>
            <Text style={styles.featureTitle}>{it.title}</Text>
            <Text style={styles.featureBody}>{it.body}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ---------------- Features ----------------
function Features({ isWide, t }: any) {
  const items = [
    { icon: "calendar-alert-outline", tint: "#FEE2E2", fg: "#EF4444", title: t("landing.feature1Title"), body: t("landing.feature1Body") },
    { icon: "credit-card-multiple-outline", tint: colors.brandTertiary, fg: colors.brand, title: t("landing.feature2Title"), body: t("landing.feature2Body") },
    { icon: "chart-line", tint: "#D1FAE5", fg: "#059669", title: t("landing.feature3Title"), body: t("landing.feature3Body") },
    { icon: "tag-heart-outline", tint: "#FEF3C7", fg: "#D97706", title: t("landing.feature4Title"), body: t("landing.feature4Body") },
    { icon: "account-group-outline", tint: "#EDE9FE", fg: "#7C3AED", title: t("landing.feature5Title"), body: t("landing.feature5Body") },
    { icon: "shield-check-outline", tint: "#CCFBF1", fg: "#0D9488", title: t("landing.feature6Title"), body: t("landing.feature6Body") },
  ];
  return (
    <View style={sharedStyles.sectionOuterAlt}>
      <View style={sharedStyles.sectionInner}>
        <SectionHeading eyebrow={t("landing.featuresEyebrow")} title={t("landing.featuresTitle")} />
        <View style={styles.featuresGrid}>
          {items.map((it) => (
            <View key={it.title} style={[styles.featureCard, isWide ? styles.painCardWide : styles.featureCardWide2]}>
              <View style={[styles.featureIcon, { backgroundColor: it.tint }]}>
                <MaterialCommunityIcons name={it.icon as any} size={24} color={it.fg} />
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

// ---------------- Dashboard Preview (#05) ----------------
function DashboardPreview({ isWide, t, onSignup }: any) {
  const items = [
    { icon: "view-grid-outline", tint: colors.brandTertiary, fg: colors.brand, title: t("landing.previewItem1Title"), body: t("landing.previewItem1Body") },
    { icon: "chart-bar", tint: "#D1FAE5", fg: "#059669", title: t("landing.previewItem2Title"), body: t("landing.previewItem2Body") },
    { icon: "lightbulb-on-outline", tint: "#FEF3C7", fg: "#D97706", title: t("landing.previewItem3Title"), body: t("landing.previewItem3Body") },
    { icon: "bell-ring-outline", tint: "#FEE2E2", fg: "#EF4444", title: t("landing.previewItem4Title"), body: t("landing.previewItem4Body") },
  ];
  return (
    <View style={sharedStyles.section}>
      <View style={[styles.previewLayout, isWide && styles.previewLayoutWide]}>
        <View style={[styles.previewText, isWide && { maxWidth: 460 }]}>
          <View style={styles.eyebrow}>
            <MaterialCommunityIcons name="view-dashboard-outline" size={14} color={colors.brandDark} />
            <Text style={styles.eyebrowText}>{t("landing.previewEyebrow")}</Text>
          </View>
          <Text style={[styles.heroTitle, isWide && { fontSize: 36, lineHeight: 42 }]}>
            {t("landing.previewTitlePart1")}
            <Text style={{ color: colors.brand }}>{t("landing.previewTitleHighlight")}</Text>
          </Text>
          <Text style={styles.heroSubtitle}>{t("landing.previewSubtitle")}</Text>

          <View style={styles.previewItemList}>
            {items.map((it) => (
              <View key={it.title} style={styles.previewItemRow}>
                <View style={[styles.featureIcon, { backgroundColor: it.tint, marginBottom: 0, width: 44, height: 44 }]}>
                  <MaterialCommunityIcons name={it.icon as any} size={20} color={it.fg} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewItemTitle}>{it.title}</Text>
                  <Text style={styles.previewItemBody}>{it.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <Button title={t("landing.previewCta")} onPress={onSignup} testID="landing-preview-signup" />
        </View>

        <View style={[styles.heroVisualWrap, isWide && styles.heroVisualWrapWide]}>
          <Image
            source={HERO_MOCKUP}
            style={[styles.heroMockupImage, { aspectRatio: HERO_MOCKUP_RATIO }]}
            contentFit="contain"
            accessibilityLabel={t("landing.heroMockupAlt")}
          />
        </View>
      </View>
    </View>
  );
}

// ---------------- How it works ----------------
function HowItWorks({ isWide, t }: any) {
  const steps = [
    { icon: "playlist-plus", title: t("landing.how1Title"), body: t("landing.how1Body") },
    { icon: "calendar-clock-outline", title: t("landing.how2Title"), body: t("landing.how2Body") },
    { icon: "bell-ring-outline", title: t("landing.how3Title"), body: t("landing.how3Body") },
    { icon: "chart-line", title: t("landing.how4Title"), body: t("landing.how4Body") },
  ];
  return (
    <View style={sharedStyles.section}>
      <SectionHeading eyebrow={t("landing.howEyebrow")} title={t("landing.howTitle")} />
      <View style={[styles.cardGrid, isWide && styles.howGridWide]}>
        {steps.map((s, i) => (
          <React.Fragment key={s.title}>
            <View style={[styles.stepCard, isWide && styles.featureCardWide]}>
              <View style={styles.stepTopRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{i + 1}</Text>
                </View>
                <View style={[styles.featureIcon, { width: 40, height: 40, marginBottom: 0 }]}>
                  <MaterialCommunityIcons name={s.icon as any} size={20} color={colors.brand} />
                </View>
              </View>
              <Text style={styles.featureTitle}>{s.title}</Text>
              <Text style={styles.featureBody}>{s.body}</Text>
            </View>
            {isWide && i < steps.length - 1 && (
              <View style={styles.stepArrowWrap}>
                <MaterialCommunityIcons name="arrow-right" size={20} color={colors.borderStrong} />
              </View>
            )}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

// ---------------- Pricing ----------------
// Reused as-is by the standalone /pricing page — onFreePress/onPremiumPress
// default to onSignup (the landing page's original single-callback usage),
// but a caller that already knows the visitor's plan (the pricing page, for
// a logged-in user) can pass its own handlers and premiumActive to swap the
// premium CTA for an "already on this plan" state instead.
export function Pricing({
  isTablet,
  onSignup,
  onFreePress,
  onPremiumPress,
  freeActive,
  premiumActive,
  eyebrow,
  title,
  t,
}: any) {
  const freeItems = [t("landing.pricingFreeItem1"), t("landing.pricingFreeItem2"), t("landing.pricingFreeItem3")];
  const premiumItems = [
    t("landing.pricingPremiumItem1"),
    t("landing.pricingPremiumItem2"),
    t("landing.pricingPremiumItem3"),
    t("landing.pricingPremiumItem4"),
  ];
  return (
    <View style={sharedStyles.sectionOuterAlt}>
      <View style={sharedStyles.sectionInner}>
        <SectionHeading
          eyebrow={eyebrow || t("landing.pricingEyebrow")}
          title={title || t("landing.pricingTitle")}
        />
        <View style={[styles.pricingRow, isTablet && styles.pricingRowWide]}>
          <View style={[styles.pricingCard, isTablet && styles.pricingCardRowFlex]}>
            <Text style={styles.pricingPlanTitle}>{t("landing.pricingFreeTitle")}</Text>
            <View style={styles.pricingPriceRow}>
              <Text style={styles.pricingPrice}>{t("landing.pricingFreePrice")}</Text>
            </View>
            <Text style={styles.pricingPriceSuffix}>{t("landing.pricingFreePriceSuffix")}</Text>

            <View style={[styles.pricingItems, isTablet && styles.pricingItemsFillWide]}>
              {freeItems.map((it) => (
                <PricingItem key={it} label={it} />
              ))}
            </View>

            {freeActive ? (
              <View style={styles.freeActivePill}>
                <MaterialCommunityIcons name="check-decagram" size={18} color={colors.brand} />
                <Text style={styles.freeActiveText}>{t("landing.pricingPremiumActive")}</Text>
              </View>
            ) : (
              <Button
                title={t("landing.pricingFreeCta")}
                onPress={onFreePress || onSignup}
                variant="secondary"
                testID="landing-pricing-free-signup"
              />
            )}
          </View>

          <View
            style={[
              styles.pricingCard,
              isTablet && styles.pricingCardRowFlex,
              styles.pricingCardHighlight,
              isTablet && styles.pricingCardHighlightWide,
            ]}
          >
            <LinearGradient
              colors={[colors.brand, colors.brandDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.pricingBadge}>
              <MaterialCommunityIcons name="crown" size={14} color={colors.brandDark} />
              <Text style={styles.pricingBadgeText}>{t("landing.pricingPremiumBadge")}</Text>
            </View>
            <Text style={[styles.pricingPlanTitle, { color: "#FFFFFF" }]}>
              {t("landing.pricingPremiumTitle")}
            </Text>
            <View style={styles.pricingPriceRow}>
              <Text style={[styles.pricingPrice, { color: "#FFFFFF" }]}>{t("landing.pricingPremiumPrice")}</Text>
              <Text style={styles.pricingPriceSuffixInline}>{t("landing.pricingPremiumPriceSuffix")}</Text>
            </View>
            <Text style={styles.pricingYearlyNote}>{t("landing.pricingPremiumYearlyNote")}</Text>

            <View style={[styles.pricingItems, isTablet && styles.pricingItemsFillWide]}>
              {premiumItems.map((it) => (
                <PricingItem key={it} label={it} inverted />
              ))}
            </View>

            {premiumActive ? (
              <View style={styles.premiumActivePill}>
                <MaterialCommunityIcons name="check-decagram" size={18} color="#FFFFFF" />
                <Text style={styles.premiumActiveText}>{t("landing.pricingPremiumActive")}</Text>
              </View>
            ) : (
              <Pressable
                onPress={onPremiumPress || onSignup}
                testID="landing-pricing-premium-signup"
                style={({ pressed }) => [styles.goldButton, pressed && { opacity: 0.9 }]}
              >
                <Text style={styles.goldButtonText}>{t("landing.pricingPremiumCta")}</Text>
              </Pressable>
            )}
          </View>
        </View>

        <PaymentTrust t={t} />
      </View>
    </View>
  );
}

function PaymentTrust({ t }: any) {
  const methods = [
    { icon: "qrcode", label: t("landing.payQris") },
    { icon: "wallet-outline", label: t("landing.payEwallet") },
    { icon: "bank-outline", label: t("landing.payBank") },
    { icon: "credit-card-outline", label: t("landing.payCard") },
  ];
  return (
    <View style={styles.paymentTrust}>
      <View style={styles.paymentMethods}>
        {methods.map((m) => (
          <View key={m.label} style={styles.paymentMethodPill}>
            <MaterialCommunityIcons name={m.icon as any} size={16} color={colors.onSurfaceSecondary} />
            <Text style={styles.paymentMethodText}>{m.label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.trustRow}>
        <MaterialCommunityIcons name="shield-check-outline" size={16} color={colors.muted} />
        <Text style={styles.trustText}>{t("landing.paymentTrustNote")}</Text>
      </View>
      <View style={styles.trustRow}>
        <MaterialCommunityIcons name="lock-outline" size={16} color={colors.muted} />
        <Text style={styles.trustText}>{t("landing.privacyTrustNote")}</Text>
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
    <View style={sharedStyles.section}>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },

  heroLayout: { flexDirection: "column", alignItems: "center" },
  heroLayoutWide: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing["3xl"] },
  heroText: { alignItems: "flex-start" },

  previewLayout: { flexDirection: "column-reverse", alignItems: "center", gap: spacing.xl },
  previewLayoutWide: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing["3xl"] },
  previewText: { alignItems: "flex-start", width: "100%" },
  previewItemList: { gap: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.xl, alignSelf: "stretch" },
  previewItemRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  previewItemTitle: { fontFamily: font.bold, fontSize: fontSize.base, color: colors.onSurface },
  previewItemBody: { fontFamily: font.regular, fontSize: fontSize.sm, color: colors.muted, marginTop: 2, lineHeight: 19 },
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

  trustBar: { width: "100%", borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  trustBarInner: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    flexDirection: "column",
    gap: spacing.md,
  },
  trustBarInnerWide: { flexDirection: "row", justifyContent: "space-around", gap: spacing.xl },
  trustBarItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm, justifyContent: "center" },
  trustBarText: { fontFamily: font.semibold, fontSize: fontSize.sm, color: colors.onSurfaceSecondary },

  heroVisualWrap: { marginTop: spacing["3xl"], width: "100%", maxWidth: 460, alignItems: "center" },
  heroVisualWrapWide: { marginTop: 0, maxWidth: 620, alignItems: "center" },
  heroMockupImage: { width: "100%" },

  cardGrid: { flexDirection: "column", gap: spacing.lg },
  cardGridWide: { flexDirection: "row", gap: spacing.xl },

  problemSubtitle: {
    fontFamily: font.medium,
    fontSize: fontSize.base,
    color: colors.muted,
    textAlign: "center",
    marginTop: -spacing.lg,
    marginBottom: spacing["2xl"],
    alignSelf: "center",
    maxWidth: 480,
  },
  // 5 pain cards: stack on mobile, wrap 3-then-2 on wide (fixed flexBasis,
  // not flex:1 — flex:1 would stretch the shorter last row to match the
  // first row's width instead of leaving it left-aligned).
  painGrid: { flexDirection: "column", gap: spacing.lg },
  painGridWide: { flexDirection: "row", flexWrap: "wrap", gap: spacing.lg },
  painCardWide: { flexBasis: "31%", flexGrow: 0 },

  // 6 feature cards: 2-up even on mobile (they're short enough not to feel
  // cramped), 3-up on wide via the shared painCardWide flexBasis.
  featuresGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  featureCardWide2: { flexBasis: "47%", flexGrow: 0 },
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
  stepTopRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: { fontFamily: font.extrabold, fontSize: fontSize.base, color: colors.onBrandPrimary },

  // 4-step "Cara Kerja" row: tighter gap than the generic cardGridWide so all
  // 4 cards + connecting arrows fit one row at typical desktop widths.
  howGridWide: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  stepArrowWrap: { paddingTop: 60 },

  pricingRow: { flexDirection: "column", gap: spacing.lg },
  pricingRowWide: { flexDirection: "row", alignItems: "stretch", gap: spacing.xl },
  pricingCard: {
    // No flex here: flex:1 uses flexBasis 0, which — combined with an
    // overflow:hidden card and an auto-height column parent (the mobile
    // stacked layout) — let the card collapse below its own content height
    // and made the last feature row render underneath the CTA button.
    // flex:1 for equal-width columns is opted into explicitly (below) only
    // in the row/desktop layout, where cross-axis stretch gives the card a
    // definite height and this can't happen.
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pricingCardRowFlex: { flex: 1 },
  pricingCardHighlight: {
    borderColor: colors.brandDark,
    overflow: "hidden",
    ...shadow.card,
  },
  pricingCardHighlightWide: {
    transform: [{ scale: 1.04 }],
    zIndex: 1,
  },
  pricingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
  },
  pricingBadgeText: { fontFamily: font.bold, fontSize: fontSize.sm, color: colors.brandDark },
  pricingPlanTitle: { fontFamily: font.extrabold, fontSize: fontSize.xl, color: colors.onSurface },
  pricingPriceRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.xs, marginTop: spacing.sm },
  pricingPrice: { fontFamily: font.extrabold, fontSize: 40, lineHeight: 44, color: colors.onSurface },
  pricingPriceSuffix: {
    fontFamily: font.medium,
    fontSize: fontSize.sm,
    color: colors.muted,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  pricingPriceSuffixInline: {
    fontFamily: font.semibold,
    fontSize: fontSize.base,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 6,
  },
  pricingYearlyNote: {
    fontFamily: font.semibold,
    fontSize: fontSize.sm,
    color: "#FFFFFF",
    backgroundColor: "rgba(255,255,255,0.16)",
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  pricingItems: { marginBottom: spacing.lg },
  pricingItemsFillWide: { flex: 1 },
  pricingItemRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  pricingItemText: { fontFamily: font.medium, fontSize: fontSize.base, color: colors.onSurface },
  goldButton: {
    height: 54,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    backgroundColor: "#FBBF24",
    boxShadow: "0px 4px 10px rgba(120, 53, 15, 0.25)",
    elevation: 3,
  },
  goldButtonText: { fontFamily: font.bold, fontSize: fontSize.lg, color: "#78350F" },
  premiumActivePill: {
    height: 54,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  premiumActiveText: { fontFamily: font.bold, fontSize: fontSize.lg, color: "#FFFFFF" },
  freeActivePill: {
    height: 54,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.brandTertiary,
  },
  freeActiveText: { fontFamily: font.bold, fontSize: fontSize.lg, color: colors.brandDark },

  paymentTrust: { alignItems: "center", marginTop: spacing["2xl"] },
  paymentMethods: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.sm },
  paymentMethodPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  paymentMethodText: { fontFamily: font.semibold, fontSize: fontSize.sm, color: colors.onSurfaceSecondary },
  trustRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md },
  trustText: { fontFamily: font.medium, fontSize: fontSize.sm, color: colors.muted, textAlign: "center" },

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
});
