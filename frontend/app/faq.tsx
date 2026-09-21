import React from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Nav, Footer, sharedStyles } from "@/src/components/landing/shared";
import { useLanguage } from "@/src/context/LanguageContext";
import { colors, font, fontSize, radius, spacing } from "@/src/theme";

// Standalone FAQ page — same content as the FAQ section on /pricing, but
// directly linkable/crawlable on its own (see PROMPT.md weakness note:
// "/pricing /blog /faq 404 — SEO lemah"). Always shows the marketing chrome
// since this is generic informational content, not account-specific.
export default function FaqPage() {
  const router = useRouter();
  const { t, language, toggleLanguage } = useLanguage();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const isTablet = width >= 640;

  const goRegister = () => router.push("/(auth)/login?mode=register");
  const goLogin = () => router.push("/(auth)/login");
  const onNavPress = (key: string) => router.push(key === "pricing" ? "/pricing" : "/");

  const faqItems = [1, 2, 3, 4, 5].map((i) => ({
    q: t(`pricingPage.faq${i}Q`),
    a: t(`pricingPage.faq${i}A`),
  }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Nav
        isWide={isWide}
        language={language}
        onToggleLanguage={toggleLanguage}
        onNavPress={onNavPress}
        onFaq={() => router.push("/faq")}
        onLogin={goLogin}
        onSignup={goRegister}
        t={t}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing["3xl"] }} showsVerticalScrollIndicator={false}>
        <View style={sharedStyles.section}>
          <View style={styles.hero}>
            <View style={styles.eyebrowPill}>
              <Text style={styles.eyebrowText}>{t("pricingPage.faqEyebrow")}</Text>
            </View>
            <Text style={styles.heroTitle}>{t("pricingPage.faqTitle")}</Text>
          </View>
        </View>

        <View style={sharedStyles.section}>
          <View style={styles.faqList}>
            {faqItems.map((item) => (
              <View key={item.q} style={styles.faqItem}>
                <Text style={styles.faqQ}>{item.q}</Text>
                <Text style={styles.faqA}>{item.a}</Text>
              </View>
            ))}
          </View>
        </View>

        <Footer isTablet={isTablet} router={router} t={t} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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

  faqList: { gap: spacing.lg },
  faqItem: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  faqQ: { fontFamily: font.bold, fontSize: fontSize.lg, color: colors.onSurface, marginBottom: spacing.xs },
  faqA: { fontFamily: font.regular, fontSize: fontSize.base, color: colors.muted, lineHeight: 21 },
});
