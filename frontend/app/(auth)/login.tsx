import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Button, Input } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useToast } from "@/src/context/ToastContext";
import { ApiError } from "@/src/lib/api";
import { colors, font, fontSize, radius, spacing } from "@/src/theme";

const HERO =
  "https://images.unsplash.com/photo-1685871286419-58e4fc0de8e1?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80";

export default function Login() {
  const insets = useSafeAreaInsets();
  const { login, register, loginWithGoogle } = useAuth();
  const toast = useToast();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);

  const isRegister = mode === "register";

  const submit = async () => {
    if (!email.trim() || !password) {
      toast.show("Email dan password wajib diisi", "error");
      return;
    }
    if (isRegister && !name.trim()) {
      toast.show("Nama wajib diisi", "error");
      return;
    }
    if (password.length < 6) {
      toast.show("Password minimal 6 karakter", "error");
      return;
    }
    setLoading(true);
    try {
      if (isRegister) {
        await register(email.trim(), password, name.trim());
      } else {
        await login(email.trim(), password);
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Terjadi kesalahan";
      toast.show(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setGLoading(true);
    try {
      await loginWithGoogle();
    } catch {
      toast.show("Login Google gagal, coba lagi", "error");
    } finally {
      setGLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Image source={{ uri: HERO }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient
            colors={["rgba(5,150,105,0.35)", "rgba(6,95,70,0.85)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.heroContent, { paddingTop: insets.top + spacing.xl }]}>
            <View style={styles.logoBadge}>
              <MaterialCommunityIcons name="bell-ring" size={26} color={colors.brand} />
            </View>
            <Text style={styles.heroTitle}>Notifin</Text>
            <Text style={styles.heroTagline}>
              Biar gak ada lagi langganan yang kelewat atau lupa di-cancel.
            </Text>
          </View>
        </View>

        <View style={styles.form}>
          <Text style={styles.formTitle}>
            {isRegister ? "Buat akun baru" : "Selamat datang kembali"}
          </Text>
          <Text style={styles.formSub}>
            {isRegister
              ? "Mulai lacak semua langgananmu di satu tempat."
              : "Masuk untuk lanjut kelola langgananmu."}
          </Text>

          <View style={{ marginTop: spacing.xl }}>
            {isRegister && (
              <Input
                testID="name-input"
                label="Nama"
                icon="account"
                placeholder="Nama kamu"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            )}
            <Input
              testID="email-input"
              label="Email"
              icon="email"
              placeholder="nama@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Input
              testID="password-input"
              label="Password"
              icon="lock"
              placeholder="Min. 6 karakter"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <Button
              testID="submit-button"
              title={isRegister ? "Daftar" : "Masuk"}
              onPress={submit}
              loading={loading}
            />

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>atau</Text>
              <View style={styles.line} />
            </View>

            <Button
              testID="google-button"
              title="Lanjutkan dengan Google"
              icon="google"
              variant="secondary"
              onPress={google}
              loading={gLoading}
            />

            <Pressable
              testID="toggle-mode-button"
              onPress={() => setMode(isRegister ? "login" : "register")}
              style={styles.toggle}
            >
              <Text style={styles.toggleText}>
                {isRegister ? "Sudah punya akun? " : "Belum punya akun? "}
                <Text style={styles.toggleLink}>{isRegister ? "Masuk" : "Daftar"}</Text>
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: {
    height: 300,
    justifyContent: "flex-end",
    overflow: "hidden",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroContent: { padding: spacing.xl, paddingBottom: spacing["2xl"] },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  heroTitle: { fontFamily: font.extrabold, fontSize: 34, color: "#FFFFFF" },
  heroTagline: {
    fontFamily: font.medium,
    fontSize: fontSize.base,
    color: "rgba(255,255,255,0.92)",
    marginTop: spacing.xs,
    lineHeight: 20,
    maxWidth: 300,
  },
  form: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  formTitle: { fontFamily: font.extrabold, fontSize: fontSize["2xl"], color: colors.onSurface },
  formSub: {
    fontFamily: font.regular,
    fontSize: fontSize.base,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginVertical: spacing.lg },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontFamily: font.medium, fontSize: fontSize.sm, color: colors.muted },
  toggle: { alignItems: "center", paddingVertical: spacing.lg },
  toggleText: { fontFamily: font.medium, fontSize: fontSize.base, color: colors.muted },
  toggleLink: { fontFamily: font.bold, color: colors.brand },
});
