import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { storage } from "@/src/utils/storage";
import { Avatar } from "@/src/components/ui";
import {
  colors,
  font,
  fontSize,
  radius,
  spacing,
  sidebarWidthCollapsed,
  sidebarWidthExpanded,
} from "@/src/theme";

const COLLAPSED_KEY = "sidebar_collapsed";

const NAV_ITEMS = [
  { href: "/", match: "/", icon: "home-outline", activeIcon: "home", labelKey: "tabs.home" },
  {
    href: "/subscriptions",
    match: "/subscriptions",
    icon: "credit-card-multiple-outline",
    activeIcon: "credit-card-multiple",
    labelKey: "tabs.subscriptions",
  },
  {
    href: "/groups",
    match: "/groups",
    icon: "account-group-outline",
    activeIcon: "account-group",
    labelKey: "tabs.groups",
  },
  { href: "/account", match: "/account", icon: "account-outline", activeIcon: "account", labelKey: "tabs.account" },
] as const;

export function Sidebar() {
  const { user, logout } = useAuth();
  const { t, locale } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    storage.getItem<boolean>(COLLAPSED_KEY, false).then((v) => setCollapsed(!!v));
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      storage.setItem(COLLAPSED_KEY, next);
      return next;
    });
  };

  return (
    <View style={[styles.root, { width: collapsed ? sidebarWidthCollapsed : sidebarWidthExpanded }]}>
      <View style={[styles.header, collapsed && styles.headerCollapsed]}>
        {!collapsed && (
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <MaterialCommunityIcons name="bell-ring" size={18} color={colors.onBrandPrimary} />
            </View>
            <Text style={styles.brandName}>Notifin</Text>
          </View>
        )}
        <Pressable
          testID="sidebar-toggle"
          onPress={toggle}
          accessibilityLabel={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
          style={styles.toggleBtn}
        >
          <MaterialCommunityIcons
            name={collapsed ? "chevron-double-right" : "chevron-double-left"}
            size={18}
            color={colors.muted}
          />
        </Pressable>
      </View>

      <Pressable
        testID="sidebar-profile"
        onPress={() => router.push("/account")}
        style={[styles.profile, collapsed && styles.profileCollapsed]}
      >
        <Avatar uri={user?.picture} name={user?.name} size={40} />
        {!collapsed && (
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.profileName} numberOfLines={1}>
              {user?.name}
            </Text>
            <View style={[styles.planPill, user?.plan === "premium" && styles.planPillPremium]}>
              {user?.plan === "premium" && <MaterialCommunityIcons name="crown" size={11} color="#B45309" />}
              <Text style={[styles.planPillText, user?.plan === "premium" && styles.planPillTextPremium]}>
                {user?.plan === "premium" ? "Premium" : t("sidebar.freePlan")}
              </Text>
            </View>
          </View>
        )}
      </Pressable>

      <View style={styles.divider} />

      <View style={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.match;
          return (
            <Pressable
              key={item.href}
              testID={`sidebar-nav-${item.labelKey.split(".")[1]}`}
              onPress={() => router.push(item.href as any)}
              style={[styles.navItem, collapsed && styles.navItemCollapsed, active && styles.navItemActive]}
            >
              <MaterialCommunityIcons
                name={active ? item.activeIcon : item.icon}
                size={22}
                color={active ? colors.brand : colors.muted}
              />
              {!collapsed && (
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>{t(item.labelKey)}</Text>
              )}
            </Pressable>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />

      {!collapsed && user?.plan === "premium" && (
        <Pressable
          testID="sidebar-premium-card"
          onPress={() => router.push("/account")}
          style={styles.premiumCard}
        >
          <Text style={styles.premiumCardTitle}>{t("dashboard.sidebarPremiumTitle")}</Text>
          <Text style={styles.premiumCardSub} numberOfLines={1}>
            {t("dashboard.sidebarPremiumActiveUntil", {
              date: user?.premium_expires_at
                ? new Date(user.premium_expires_at).toLocaleDateString(locale, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "-",
            })}
          </Text>
          <View style={styles.premiumCardBtn}>
            <Text style={styles.premiumCardBtnText}>{t("dashboard.sidebarPremiumCta")}</Text>
          </View>
        </Pressable>
      )}

      <Pressable
        testID="sidebar-logout"
        onPress={logout}
        style={[styles.navItem, collapsed && styles.navItemCollapsed, styles.logoutItem]}
      >
        <MaterialCommunityIcons name="logout" size={20} color={colors.muted} />
        {!collapsed && <Text style={styles.navLabel}>{t("account.logoutAction")}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    height: "100%",
    backgroundColor: colors.surfaceSecondary,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  headerCollapsed: { justifyContent: "center" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  brandMark: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: { fontFamily: font.extrabold, fontSize: fontSize.lg, color: colors.onSurface },
  toggleBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },

  profile: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  profileCollapsed: { justifyContent: "center" },
  profileName: { fontFamily: font.bold, fontSize: fontSize.base, color: colors.onSurface },
  planPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginTop: 2,
  },
  planPillPremium: { backgroundColor: "#FEF3C7" },
  planPillText: { fontFamily: font.semibold, fontSize: 11, color: colors.onSurfaceTertiary },
  planPillTextPremium: { color: "#92400E" },

  divider: { height: 1, backgroundColor: colors.divider, marginBottom: spacing.md },

  nav: { gap: spacing.xs },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  navItemCollapsed: { justifyContent: "center", paddingHorizontal: 0 },
  navItemActive: { backgroundColor: colors.brandTertiary },
  navLabel: { fontFamily: font.semibold, fontSize: fontSize.base, color: colors.muted },
  navLabelActive: { color: colors.brand },
  logoutItem: { marginTop: spacing.md },

  premiumCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  premiumCardTitle: { fontFamily: font.bold, fontSize: fontSize.sm, color: "#78350F" },
  premiumCardSub: { fontFamily: font.medium, fontSize: 11, color: "#92400E", marginTop: 2 },
  premiumCardBtn: {
    marginTop: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: radius.pill,
    paddingVertical: 6,
    alignItems: "center",
  },
  premiumCardBtnText: { fontFamily: font.bold, fontSize: 11, color: "#92400E" },
});
