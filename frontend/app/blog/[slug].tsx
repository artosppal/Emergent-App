import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Nav, Footer, sharedStyles } from "@/src/components/landing/shared";
import { useLanguage } from "@/src/context/LanguageContext";
import { getPostBySlug } from "@/src/content/blog";
import { colors, font, fontSize, radius, spacing, webMaxWidth } from "@/src/theme";

export default function BlogPost() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, language, toggleLanguage, locale } = useLanguage();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const isTablet = width >= 640;

  const goRegister = () => router.push("/(auth)/login?mode=register");
  const goLogin = () => router.push("/(auth)/login");
  const onNavPress = (key: string) => router.push(key === "pricing" ? "/pricing" : "/");

  const post = getPostBySlug(String(slug));

  if (!post) {
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
        <View style={styles.notFoundWrap}>
          <Text style={styles.notFoundTitle}>{t("blog.notFoundTitle")}</Text>
          <Pressable onPress={() => router.push("/blog")}>
            <Text style={styles.backLink}>{"< " + t("blog.backToBlog")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

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
        <View style={[sharedStyles.section, { maxWidth: webMaxWidth }]}>
          <Pressable onPress={() => router.push("/blog")} style={{ marginBottom: spacing.lg }}>
            <Text style={styles.backLink}>{"< " + t("blog.backToBlog")}</Text>
          </Pressable>

          <Text style={styles.meta}>
            {fmtDate(post.publishedAt)} · {t("blog.readMinutes", { n: post.readMinutes })}
          </Text>
          <Text style={styles.title}>{post.title[language]}</Text>

          <View style={styles.body}>
            {post.body[language].map((para, i) =>
              para.startsWith("## ") ? (
                <Text key={i} style={styles.heading}>
                  {para.slice(3)}
                </Text>
              ) : (
                <Text key={i} style={styles.paragraph}>
                  {para}
                </Text>
              ),
            )}
          </View>

          <View style={styles.ctaBanner}>
            <MaterialCommunityIcons name="bell-ring" size={22} color="#FFFFFF" />
            <Text style={styles.ctaText}>{t("blog.ctaText")}</Text>
            <Pressable onPress={goRegister} style={styles.ctaButton}>
              <Text style={styles.ctaButtonText}>{t("landing.navSignup")}</Text>
            </Pressable>
          </View>
        </View>

        <Footer isTablet={isTablet} router={router} t={t} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  notFoundWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  notFoundTitle: { fontFamily: font.bold, fontSize: fontSize.xl, color: colors.onSurface },

  backLink: { fontFamily: font.semibold, fontSize: fontSize.base, color: colors.brand },
  meta: { fontFamily: font.semibold, fontSize: fontSize.sm, color: colors.muted },
  title: {
    fontFamily: font.extrabold,
    fontSize: 30,
    lineHeight: 36,
    color: colors.onSurface,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },

  body: { gap: spacing.md },
  paragraph: { fontFamily: font.regular, fontSize: fontSize.base, lineHeight: 24, color: colors.onSurface },
  heading: {
    fontFamily: font.bold,
    fontSize: fontSize.lg,
    color: colors.onSurface,
    marginTop: spacing.md,
  },

  ctaBanner: {
    marginTop: spacing["2xl"],
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  ctaText: { fontFamily: font.semibold, fontSize: fontSize.base, color: "#FFFFFF", textAlign: "center" },
  ctaButton: {
    marginTop: spacing.xs,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
  },
  ctaButtonText: { fontFamily: font.bold, fontSize: fontSize.base, color: colors.brand },
});
