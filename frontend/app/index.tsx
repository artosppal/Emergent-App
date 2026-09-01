import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, font, fontSize, spacing } from "@/src/theme";

// Branded splash while the auth gate (root layout) decides the destination.
export default function Index() {
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
