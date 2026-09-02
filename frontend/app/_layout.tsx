import "react-native-gesture-handler";
import React, { useEffect } from "react";
import { Platform, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { LogBox } from "react-native";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider, useAuth } from "@/src/context/AuthContext";
import { ToastProvider } from "@/src/context/ToastContext";
import { UpgradeProvider } from "@/src/context/UpgradeContext";
import { colors } from "@/src/theme";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

// Foreground notification behaviour (module scope).
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
  });
}

function RootNavigator() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === "(auth)";
    const atRoot = segments.length === 0;
    if (!user && !inAuth) {
      router.replace("/(auth)/login");
    } else if (user && (inAuth || atRoot)) {
      router.replace("/(tabs)");
    }
  }, [user, loading, segments, router]);

  // Notification tap handling (native only).
  useEffect(() => {
    if (Platform.OS === "web") return;
    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data: any = response.notification.request.content.data || {};
      const url = data.deeplink || data.action_url;
      if (url) {
        url.startsWith("http") ? Linking.openURL(url) : router.push(url);
      }
    });
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data: any = response.notification.request.content.data || {};
      const url = data.deeplink || data.action_url;
      if (url) url.startsWith("http") ? Linking.openURL(url) : router.push(url);
    });
    return () => tapSub.remove();
  }, [router]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="subscription/form" options={{ presentation: "modal" }} />
      <Stack.Screen name="group/[id]" />
      <Stack.Screen name="group/add-sub" options={{ presentation: "modal" }} />
      <Stack.Screen name="group/history" />
    </Stack>
  );
}

export default function RootLayout() {
  const [iconsLoaded, iconsError] = useIconFonts();
  const [fontsLoaded, fontsError] = useFonts({
    "PlusJakarta-Regular": require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    "PlusJakarta-Medium": require("../assets/fonts/PlusJakartaSans-Medium.ttf"),
    "PlusJakarta-SemiBold": require("../assets/fonts/PlusJakartaSans-SemiBold.ttf"),
    "PlusJakarta-Bold": require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
    "PlusJakarta-ExtraBold": require("../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
  });

  const ready = (iconsLoaded || iconsError) && (fontsLoaded || fontsError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaProvider>
        <KeyboardProvider>
        <BottomSheetModalProvider>
          <AuthProvider>
            <ToastProvider>
              <UpgradeProvider>
                <StatusBar style="dark" />
                <RootNavigator />
              </UpgradeProvider>
            </ToastProvider>
          </AuthProvider>
        </BottomSheetModalProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
