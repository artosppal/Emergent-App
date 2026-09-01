import React, { useContext } from "react";
import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { StyleSheet, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { colors, font } from "@/src/theme";

function TabIcon({ name, color, focused }: { name: string; color: string; focused: boolean }) {
  return (
    <MaterialCommunityIcons name={name as any} size={focused ? 27 : 25} color={color} />
  );
}

export default function TabsLayout() {
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
          title: "Beranda",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "home" : "home-outline"} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="subscriptions"
        options={{
          title: "Langganan",
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
          title: "Grup",
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
          title: "Akun",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "account" : "account-outline"} color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  blur: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: "rgba(247,250,248,0.6)",
  },
});
