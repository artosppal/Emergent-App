// Pieces shared between the marketing landing page and standalone pages
// that reuse its chrome (e.g. the pricing page) — nav bar, section heading,
// and footer, plus the layout styles they depend on.
import React, { useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, font, fontSize, radius, spacing } from "@/src/theme";

export const MAX_WIDTH = 1120;

// react-native-web's Linking.openURL() opens mailto: links via window.open(url,
// "_blank"), which pops a new browser tab that just sits there if the OS/browser
// has no default mail client wired up -- looks like "it opened the browser
// instead of my mail app". window.location.href hands the current tab straight
// to the mailto: handler with no extra tab in between.
function openSupportEmail() {
  if (Platform.OS === "web") {
    window.location.href = "mailto:support@notifin.online";
  } else {
    Linking.openURL("mailto:support@notifin.online");
  }
}

export function Nav({ isWide, language, onToggleLanguage, onNavPress, onFaq, onLogin, onSignup, t }: any) {
  return (
    <View style={sharedStyles.navBar}>
      <View style={sharedStyles.navInner}>
        <View style={sharedStyles.brandRow}>
          <View style={sharedStyles.brandMark}>
            <MaterialCommunityIcons name="bell-ring" size={20} color={colors.onBrandPrimary} />
          </View>
          <Text style={sharedStyles.brandName}>Notifin</Text>
          {isWide && <Text style={sharedStyles.brandSlogan}>/ {t("landing.navSlogan")}</Text>}
        </View>

        {isWide && (
          <View style={sharedStyles.navLinks}>
            <Pressable onPress={() => onNavPress("features")}>
              <Text style={sharedStyles.navLink}>{t("landing.navFeatures")}</Text>
            </Pressable>
            <Pressable onPress={() => onNavPress("how")}>
              <Text style={sharedStyles.navLink}>{t("landing.navHow")}</Text>
            </Pressable>
            <Pressable onPress={() => onNavPress("pricing")}>
              <Text style={sharedStyles.navLink}>{t("landing.navPricing")}</Text>
            </Pressable>
            <Pressable onPress={onFaq} testID="landing-nav-faq">
              <Text style={sharedStyles.navLink}>{t("landing.navFaq")}</Text>
            </Pressable>
          </View>
        )}

        <View style={sharedStyles.navActions}>
          <Pressable onPress={onToggleLanguage} style={sharedStyles.langPill} testID="landing-lang-toggle">
            <Text style={sharedStyles.langPillText}>{language.toUpperCase()}</Text>
          </Pressable>
          {isWide && (
            <Pressable onPress={onLogin} style={sharedStyles.navLoginBtn} testID="landing-nav-login">
              <Text style={sharedStyles.navLoginText}>{t("landing.navLogin")}</Text>
            </Pressable>
          )}
          <Pressable onPress={onSignup} style={sharedStyles.navSignupBtn} testID="landing-nav-signup">
            <Text style={sharedStyles.navSignupText}>{t("landing.navSignup")}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View style={sharedStyles.headingWrap}>
      <Text style={sharedStyles.headingEyebrow}>{eyebrow}</Text>
      <Text style={sharedStyles.headingTitle}>{title}</Text>
    </View>
  );
}

export function Footer({ isTablet, router, t }: any) {
  return (
    <View style={sharedStyles.section}>
      <View style={[sharedStyles.footerRow, isTablet && sharedStyles.footerRowWide]}>
        <View style={{ maxWidth: 320 }}>
          <View style={sharedStyles.brandRow}>
            <View style={sharedStyles.brandMark}>
              <MaterialCommunityIcons name="bell-ring" size={18} color={colors.onBrandPrimary} />
            </View>
            <Text style={sharedStyles.brandName}>Notifin</Text>
          </View>
          <Text style={sharedStyles.footerTagline}>{t("landing.footerTagline")}</Text>
        </View>

        <View style={sharedStyles.footerLinks}>
          <Pressable onPress={() => router.push("/pricing")}>
            <Text style={sharedStyles.footerLink}>{t("landing.navPricing")}</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/faq")}>
            <Text style={sharedStyles.footerLink}>{t("landing.footerFaq")}</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/blog")}>
            <Text style={sharedStyles.footerLink}>{t("landing.footerBlog")}</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/privacy")}>
            <Text style={sharedStyles.footerLink}>{t("landing.footerPrivacy")}</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/terms")}>
            <Text style={sharedStyles.footerLink}>{t("landing.footerTerms")}</Text>
          </Pressable>
        </View>
      </View>
      <Pressable onPress={openSupportEmail}>
        <Text style={sharedStyles.footerSupport}>{t("landing.footerSupport")} support@notifin.online</Text>
      </Pressable>
      <Text style={sharedStyles.footerCopyright}>
        © {new Date().getFullYear()} Notifin. {t("landing.footerRights")}
      </Text>
    </View>
  );
}

// Shared accordion FAQ list — used on both the landing page's /faq page and
// the /pricing page's FAQ section, so both stay in sync instead of each
// keeping its own static (always-expanded) copy of the same questions.
export function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  return (
    <View style={sharedStyles.faqList}>
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <Pressable
            key={item.q}
            testID={`faq-item-${i}`}
            onPress={() => setOpenIndex(open ? null : i)}
            style={sharedStyles.faqItem}
          >
            <View style={sharedStyles.faqQRow}>
              <Text style={sharedStyles.faqQ}>{item.q}</Text>
              <MaterialCommunityIcons
                name={open ? "chevron-up" : "chevron-down"}
                size={20}
                color={colors.muted}
              />
            </View>
            {open && <Text style={sharedStyles.faqA}>{item.a}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

export const sharedStyles = StyleSheet.create({
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
  brandSlogan: { fontFamily: font.medium, fontSize: fontSize.sm, color: colors.muted },

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

  footerRow: { flexDirection: "column", gap: spacing.xl },
  footerRowWide: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  footerTagline: { fontFamily: font.regular, fontSize: fontSize.sm, color: colors.muted, marginTop: spacing.md, lineHeight: 19 },
  footerLinks: { flexDirection: "row", gap: spacing.xl },
  footerLink: { fontFamily: font.semibold, fontSize: fontSize.base, color: colors.onSurfaceSecondary },
  footerSupport: {
    fontFamily: font.medium,
    fontSize: fontSize.sm,
    color: colors.brand,
    marginTop: spacing.xl,
    textAlign: "center",
  },
  footerCopyright: {
    fontFamily: font.regular,
    fontSize: fontSize.sm,
    color: colors.muted,
    marginTop: spacing["2xl"],
    textAlign: "center",
  },

  faqList: { gap: spacing.md },
  faqItem: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  faqQRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  faqQ: { flex: 1, fontFamily: font.bold, fontSize: fontSize.lg, color: colors.onSurface },
  faqA: {
    fontFamily: font.regular,
    fontSize: fontSize.base,
    color: colors.muted,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
});
