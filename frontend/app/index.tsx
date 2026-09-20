import React, { useEffect } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { LandingPage } from "@/src/components/landing/LandingPage";
import { colors, font, fontSize, spacing } from "@/src/theme";

// Web + logged-out: show the marketing landing page.
// Native, or still resolving/authenticated: branded splash while the auth
// gate (root layout, or the redirect below on native) decides the destination.
export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === "web" || loading || user) return;
    router.replace("/(auth)/login");
  }, [loading, user, router]);

  if (Platform.OS === "web" && !loading && !user) {
    return (
      <>
        <Head>
          <title>Notifin - Kelola Langgananmu</title>
          <meta
            name="description"
            content="Notifin ingetin kamu sebelum trial gratis berubah jadi tagihan, dan bantu lacak semua pengeluaran langganan bulananmu."
          />
          <meta property="og:title" content="Notifin - Kelola Langgananmu" />
          <meta
            property="og:description"
            content="Notifin ingetin kamu sebelum trial gratis berubah jadi tagihan, dan bantu lacak semua pengeluaran langganan bulananmu."
          />
          <meta property="og:url" content="https://notifin.online/" />
        </Head>
        <LandingPage />
      </>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.logo}>
        <MaterialCommunityIcons name="bell-ring" size={40} color={colors.onBrandPrimary} />
      </View>
      <Text style={styles.name}>Notifin</Text>
      <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.lg }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  name: { fontFamily: font.extrabold, fontSize: fontSize["3xl"], color: colors.onSurface },
});
