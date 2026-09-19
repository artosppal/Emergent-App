import React, { useContext } from "react";
import { Platform, useWindowDimensions } from "react-native";
import { Tabs, Slot } from "expo-router";
import { BlurView } from "expo-blur";
import { StyleSheet, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { colors, font, sidebarBreakpoint } from "@/src/theme";
import { useLanguage } from "@/src/context/LanguageContext";
import { Sidebar } from "@/src/components/layout/Sidebar";

function TabIcon({ name, color, focused }: { name: string; color: string; focused: boolean }) {
  return (
    <MaterialCommunityIcons name={name as any} size={focused ? 27 : 25} color={color} />
  );
}

export default function TabsLayout() {
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const useSidebar = Platform.OS === "web" && width >= sidebarBreakpoint;

  if (useSidebar) {
    return (
      <View style={styles.sidebarShell}>
        <Sidebar />
        <View style={styles.sidebarContent}>
          {/* Screens read this to pad their scroll content above the (now
              absent) bottom tab bar; 0 here means "no bar to clear". */}
          <BottomTabBarHeightContext.Provider value={0}>
            <Slot />
          </BottomTabBarHeightContext.Provider>
        </View>
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 11 },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarStyle: {
          position: "absolute",
          borderTopWidth: 0,
          backgroundColor: Platform.OS === "web" ? colors.surfaceSecondary : "transparent",
          elevation: 0,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarBackground: () =>
          Platform.OS === "web" ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceSecondary }]} />
          ) : (
            <BlurView
              intensity={70}
              tint="light"
              style={[StyleSheet.absoluteFill, styles.blur]}
            />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home"),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "home" : "home-outline"} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="subscriptions"
        options={{
          title: t("tabs.subscriptions"),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? "credit-card-multiple" : "credit-card-multiple-outline"}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: t("tabs.groups"),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? "account-group" : "account-group-outline"}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t("tabs.account"),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "account" : "account-outline"} color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  sidebarShell: { flex: 1, flexDirection: "row", backgroundColor: colors.surface },
  sidebarContent: { flex: 1 },
  blur: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: "rgba(247,250,248,0.6)",
  },
});
