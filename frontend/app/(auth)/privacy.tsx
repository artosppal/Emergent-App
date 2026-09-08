import React from "react";
import { ScrollView, Text, View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, font, fontSize, spacing } from "@/src/theme";

function P({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: font.regular,
        fontSize: fontSize.base,
        lineHeight: 22,
        color: colors.onSurface,
        marginBottom: spacing.md,
      }}
    >
      {children}
    </Text>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: font.bold,
        fontSize: fontSize.lg,
        color: colors.onSurface,
        marginTop: spacing.xl,
        marginBottom: spacing.sm,
      }}
    >
      {children}
    </Text>
  );
}

export default function Privacy() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View
        style={{
          paddingTop: insets.top + spacing.md,
          paddingHorizontal: spacing.xl,
          paddingBottom: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(auth)/login"))}>
          <Text style={{ fontFamily: font.semibold, fontSize: fontSize.base, color: colors.brand }}>
            {"< Kembali"}
          </Text>
        </Pressable>
        <Text style={{ fontFamily: font.extrabold, fontSize: fontSize["2xl"], color: colors.onSurface, marginTop: spacing.md }}>
          Kebijakan Privasi
        </Text>
        <Text style={{ fontFamily: font.regular, fontSize: fontSize.sm, color: colors.muted, marginTop: spacing.xs }}>
          Berlaku untuk aplikasi Notifin (notifin.online)
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, paddingBottom: spacing["3xl"] }}>
        <P>
          Notifin adalah aplikasi pencatat dan pengingat langganan pribadi. Kebijakan ini menjelaskan data apa
          yang kami kumpulkan, untuk apa data itu digunakan, dan bagaimana kamu bisa mengontrolnya.
        </P>

        <H>Data yang kami kumpulkan</H>
        <P>• Akun: email, nama, dan foto profil — dari pendaftaran manual atau Sign in with Google.</P>
        <P>• Nomor WhatsApp — hanya jika kamu isi sendiri untuk mengaktifkan pengingat WhatsApp.</P>
        <P>• Data langganan yang kamu catat sendiri: nama layanan, harga, tanggal jatuh tempo, kategori, dan catatan lain yang kamu masukkan.</P>
        <P>• Data teknis dasar seperti token perangkat (untuk notifikasi push) dan waktu aktif terakhir.</P>

        <H>Untuk apa data digunakan</H>
        <P>• Mengelola akun dan sesi login kamu.</P>
        <P>• Mengirim pengingat jatuh tempo langganan lewat notifikasi push dan/atau WhatsApp.</P>
        <P>• Memproses pembayaran upgrade ke Premium.</P>
        <P>• Memperbaiki dan mengembangkan fitur aplikasi.</P>
        <P>Kami tidak menjual data pribadi kamu ke pihak ketiga mana pun.</P>

        <H>Pihak ketiga yang terlibat</H>
        <P>• Google — untuk Sign in with Google (opsional, kamu tetap bisa daftar pakai email/password).</P>
        <P>• Fonnte — untuk mengirim pesan pengingat WhatsApp, hanya jika kamu aktifkan.</P>
        <P>• Mayar.id — untuk memproses pembayaran langganan Premium.</P>

        <H>Penyimpanan dan keamanan</H>
        <P>
          Data disimpan di basis data terkelola dan diakses lewat koneksi terenkripsi. Password disimpan dalam
          bentuk hash, bukan teks biasa.
        </P>

        <H>Hak kamu</H>
        <P>
          Kamu bisa meminta penghapusan akun dan seluruh data terkait kapan saja dengan menghubungi kami lewat
          email di bawah.
        </P>

        <H>Kontak</H>
        <P>Ada pertanyaan soal privasi? Hubungi kami di artosppal@gmail.com.</P>

        <P>Kebijakan ini bisa diperbarui sewaktu-waktu; perubahan penting akan diinformasikan di dalam aplikasi.</P>
      </ScrollView>
    </View>
  );
}
