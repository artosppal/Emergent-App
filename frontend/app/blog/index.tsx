import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Nav, Footer, sharedStyles } from "@/src/components/landing/shared";
import { useLanguage } from "@/src/context/LanguageContext";
import { listPosts } from "@/src/content/blog";
import { colors, font, fontSize, radius, spacing, shadow } from "@/src/theme";

export default function BlogIndex() {
  const router = useRouter();
  const { t, language, toggleLanguage, locale } = useLanguage();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const isTablet = width >= 640;

  const goRegister = () => router.push("/(auth)/login?mode=register");
  const goLogin = () => router.push("/(auth)/login");
  const onNavPress = (key: string) => router.push(key === "pricing" ? "/pricing" : "/");

  const posts = listPosts();
  const fmtDate = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Nav
        isWide={isWide}
        language={language}
        onToggleLanguage={toggleLanguage}
        onNavPress={onNavPress}
        onLogin={goLogin}
        onSignup={goRegister}
        t={t}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing["3xl"] }} showsVerticalScrollIndicator={false}>
        <View style={sharedStyles.section}>
          <View style={styles.hero}>
            <View style={styles.eyebrowPill}>
              <Text style={styles.eyebrowText}>{t("blog.eyebrow")}</Text>
            </View>
            <Text style={styles.heroTitle}>{t("blog.title")}</Text>
            <Text style={styles.heroSubtitle}>{t("blog.subtitle")}</Text>
          </View>
        </View>

        <View style={sharedStyles.section}>
          <View style={[styles.grid, isWide && styles.gridWide]}>
            {posts.map((post) => (
              <Pressable
                key={post.slug}
                testID={`blog-post-${post.slug}`}
                onPress={() => router.push(`/blog/${post.slug}`)}
                style={({ pressed }) => [styles.card, isWide && styles.cardWide, pressed && { opacity: 0.9 }]}
              >
                <Text style={styles.cardDate}>
                  {fmtDate(post.publishedAt)} · {t("blog.readMinutes", { n: post.readMinutes })}
                </Text>
                <Text style={styles.cardTitle}>{post.title[language]}</Text>
                <Text style={styles.cardExcerpt}>{post.excerpt[language]}</Text>
                <View style={styles.cardReadMore}>
                  <Text style={styles.cardReadMoreText}>{t("blog.readMore")}</Text>
                  <MaterialCommunityIcons name="arrow-right" size={16} color={colors.brand} />
                </View>
              </Pressable>
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
  heroSubtitle: {
    fontFamily: font.medium,
    fontSize: fontSize.lg,
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.md,
    maxWidth: 480,
  },

  grid: { flexDirection: "column", gap: spacing.lg },
  gridWide: { flexDirection: "row", flexWrap: "wrap" },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadow.soft,
  },
  cardWide: { width: "48%", marginRight: "2%", marginBottom: spacing.lg },
  cardDate: { fontFamily: font.semibold, fontSize: fontSize.sm, color: colors.muted },
  cardTitle: { fontFamily: font.bold, fontSize: fontSize.xl, color: colors.onSurface, marginTop: spacing.sm },
  cardExcerpt: { fontFamily: font.regular, fontSize: fontSize.base, color: colors.muted, marginTop: spacing.sm, lineHeight: 21 },
  cardReadMore: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.lg },
  cardReadMoreText: { fontFamily: font.bold, fontSize: fontSize.sm, color: colors.brand },
});
