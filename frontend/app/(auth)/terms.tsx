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

export default function Terms() {
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
          Syarat & Ketentuan
        </Text>
        <Text style={{ fontFamily: font.regular, fontSize: fontSize.sm, color: colors.muted, marginTop: spacing.xs }}>
          Berlaku untuk aplikasi Notifin (notifin.online)
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, paddingBottom: spacing["3xl"] }}>
        <P>
          Dengan membuat akun dan menggunakan Notifin, kamu menyetujui syarat dan ketentuan di bawah ini.
        </P>

        <H>Layanan</H>
        <P>
          Notifin membantu kamu mencatat langganan berbayar dan mengingatkan tanggal jatuh tempo lewat
          notifikasi push dan/atau WhatsApp. Notifin bukan penyedia layanan langganan itu sendiri, hanya
          alat bantu pencatatan dan pengingat.
        </P>

        <H>Paket Free dan Premium</H>
        <P>
          Paket Free memiliki batas jumlah langganan yang bisa dicatat. Paket Premium membuka batas lebih
          tinggi dan fitur tambahan, dibayar berlangganan bulanan/tahunan lewat mitra pembayaran Mayar.id.
        </P>

        <H>Pembayaran</H>
        <P>
          Pembayaran Premium diproses oleh Mayar.id. Status Premium aktif setelah pembayaran dikonfirmasi.
          Untuk pertanyaan seputar tagihan, pembatalan, atau pengembalian dana, hubungi kami langsung di
          email di bawah — kami akan bantu proses sesuai kasusnya.
        </P>

        <H>Akurasi pengingat</H>
        <P>
          Pengingat dikirim berdasarkan tanggal yang kamu masukkan sendiri. Notifin tidak bertanggung jawab
          atas keterlambatan atau kegagalan pengiriman notifikasi akibat gangguan pihak ketiga (mis. jaringan,
          penyedia WhatsApp, atau sistem notifikasi perangkat).
        </P>

        <H>Penggunaan yang wajar</H>
        <P>
          Jangan gunakan Notifin untuk mengirim pesan yang melanggar hukum, spam, atau merugikan pihak lain.
          Kami berhak menonaktifkan akun yang menyalahgunakan layanan.
        </P>

        <H>Perubahan layanan</H>
        <P>
          Kami dapat mengubah atau menghentikan sebagian fitur dari waktu ke waktu. Perubahan penting akan
          diinformasikan di dalam aplikasi.
        </P>

        <H>Kontak</H>
        <P>Pertanyaan seputar syarat & ketentuan ini bisa dikirim ke artosppal@gmail.com.</P>
      </ScrollView>
    </View>
  );
}
