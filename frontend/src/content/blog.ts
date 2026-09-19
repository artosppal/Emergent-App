// Blog content, bundled at build time (no CMS yet — see memory/PRD.md).
// Body paragraphs starting with "## " render as subheadings; everything
// else is a plain paragraph. Keep entries practical and generic — no
// fabricated statistics or claims about Notifin's own user base.
export interface BlogPost {
  slug: string;
  publishedAt: string; // ISO date, YYYY-MM-DD
  readMinutes: number;
  title: { id: string; en: string };
  excerpt: { id: string; en: string };
  body: { id: string[]; en: string[] };
}

export const blogPosts: BlogPost[] = [
  {
    slug: "tanda-kebanyakan-langganan-digital",
    publishedAt: "2026-09-01",
    readMinutes: 4,
    title: {
      id: "5 Tanda Kamu Kebanyakan Langganan Digital",
      en: "5 Signs You Have Too Many Digital Subscriptions",
    },
    excerpt: {
      id: "Dari kartu yang kena tagih tiap bulan sampai lupa app apa aja yang masih aktif — ini tanda-tanda paling umum, dan langkah pertama buat beresinnya.",
      en: "From a card that gets charged every month to forgetting what's even still active — the most common signs, and the first step to sorting it out.",
    },
    body: {
      id: [
        "Langganan digital itu enak di depan — daftar sekali, lupakan, terus jalan otomatis. Masalahnya justru di situ: karena semuanya otomatis, gampang banget lupa berapa banyak yang sebenarnya aktif.",
        "## 1. Kamu kaget tiap lihat mutasi kartu",
        "Kalau notifikasi tagihan kartu bikin mikir \"ini dari mana ya\" lebih dari sekali bulan ini, itu tanda paling jelas. Bukan berarti ada yang salah — cuma berarti belum ada yang mencatatnya di satu tempat.",
        "## 2. Trial gratis yang \"nanti dicancel\" tapi kelupaan",
        "Trial 7 atau 14 hari dirancang supaya kamu lupa. Begitu kartu terpasang di awal, sistemnya jalan sendiri kalau nggak ada yang ingetin sebelum tanggal berakhirnya.",
        "## 3. Ada langganan yang udah berbulan-bulan nggak dibuka",
        "Streaming yang didaftar buat nonton satu serial, lalu nggak pernah dibuka lagi setelah itu — tapi tagihannya tetap jalan tiap bulan.",
        "## 4. Nggak tahu pasti totalnya per bulan",
        "Coba jawab spontan: total semua langgananmu bulan ini berapa? Kalau jawabannya \"kira-kira\", itu tandanya belum ada yang menjumlahkan secara nyata.",
        "## 5. Ada dua langganan yang fungsinya mirip",
        "Dua aplikasi musik, dua cloud storage, dua layanan streaming yang overlap kontennya — sering kejadian karena masing-masing didaftar di waktu berbeda dan nggak pernah dibandingkan.",
        "## Langkah pertama",
        "Nggak perlu langsung cancel semuanya. Langkah paling realistis: catat dulu semua yang aktif, harga, dan tanggal jatuh temponya di satu tempat — baru dari situ kelihatan mana yang worth it dan mana yang nggak.",
      ],
      en: [
        "Digital subscriptions are easy going in — sign up once, forget about it, it just keeps running. That's exactly the problem: because everything is automatic, it's easy to lose track of how many are actually still active.",
        "## 1. Your card statement surprises you",
        "If a charge notification makes you think \"wait, what's this from\" more than once this month, that's the clearest sign. It doesn't mean anything's wrong — just that nothing has been tracking it in one place.",
        "## 2. Free trials you meant to cancel, but forgot",
        "7 or 14-day trials are designed to be forgotten. Once a card is on file, the system just keeps going unless something reminds you before the trial ends.",
        "## 3. Something you haven't opened in months",
        "A streaming service you signed up for to watch one show, then never opened again — but the charge keeps showing up every month regardless.",
        "## 4. You don't actually know your monthly total",
        "Try answering on the spot: what's the total across all your subscriptions this month? If the answer is \"roughly,\" nothing has actually added it up yet.",
        "## 5. Two subscriptions doing the same job",
        "Two music apps, two cloud storage plans, two streaming services with overlapping content — usually happens because each was signed up for at a different time and never compared side by side.",
        "## Where to start",
        "You don't need to cancel everything at once. The most realistic first step: list what's active, its price, and its due date in one place — from there it's obvious which ones are worth keeping.",
      ],
    },
  },
  {
    slug: "hindari-kena-tagih-setelah-trial",
    publishedAt: "2026-09-08",
    readMinutes: 3,
    title: {
      id: "Cara Menghindari Kena Tagih Setelah Trial Gratis Berakhir",
      en: "How to Avoid Getting Charged When a Free Trial Ends",
    },
    excerpt: {
      id: "Trial gratis dirancang buat berubah jadi langganan berbayar otomatis. Ini cara supaya keputusannya tetap di tangan kamu, bukan di tangan tanggal kalender.",
      en: "Free trials are designed to auto-convert into paid subscriptions. Here's how to keep that decision in your hands, not the calendar's.",
    },
    body: {
      id: [
        "Model bisnis trial gratis itu sederhana: makin banyak orang lupa cancel, makin bagus buat penyedia layanan. Bukan berarti curang — cuma berarti kamu perlu sistem sendiri buat melawan lupa itu.",
        "## Catat tanggal berakhirnya, bukan tanggal daftarnya",
        "Yang penting bukan kapan kamu mulai trial, tapi kapan trial itu BERAKHIR — karena itu tanggal keputusan sebenarnya harus diambil.",
        "## Kasih jeda buat mikir, jangan mepet di hari-H",
        "Kalau pengingatnya baru muncul persis di hari terakhir, kamu udah kepepet dan biasanya milih \"lanjut aja dulu deh\" daripada mikir jernih. Pengingat 2-3 hari sebelumnya kasih ruang buat mutusin dengan tenang.",
        "## Bedakan trial yang \"worth dilanjutin\" dan yang \"asal coba\"",
        "Nggak semua trial harus dicancel — kalau memang kepake dan sesuai budget, lanjut aja. Yang perlu dihindari itu lanjut BUKAN karena keputusan sadar, tapi karena lupa ada pilihan buat cancel.",
        "## Satu tempat buat semua tanggal",
        "Trial yang tersebar di banyak email jadi gampang kelewat. Mencatatnya di satu tempat, dengan pengingat yang konsisten, jauh lebih reliable daripada mengandalkan ingatan sendiri.",
      ],
      en: [
        "The free-trial business model is simple: the more people forget to cancel, the better it is for the provider. That's not necessarily deceptive — it just means you need your own system to counter the forgetting.",
        "## Track the end date, not the start date",
        "What matters isn't when you started the trial, but when it ENDS — because that's the actual date a decision has to be made.",
        "## Give yourself room to think, don't cut it close",
        "If the reminder only shows up on the very last day, you're already rushed and tend to pick \"let's just keep it\" over a clear-headed choice. A reminder 2-3 days out gives room to decide calmly.",
        "## Separate \"worth keeping\" from \"just trying it out\"",
        "Not every trial needs to be canceled — if it's genuinely useful and fits the budget, keep it. What's worth avoiding is continuing NOT as a conscious choice, but simply because the option to cancel was forgotten.",
        "## One place for every date",
        "Trials scattered across many emails are easy to miss. Tracking them in one place, with a consistent reminder, is far more reliable than counting on memory alone.",
      ],
    },
  },
  {
    slug: "menghitung-pengeluaran-langganan-bulanan",
    publishedAt: "2026-09-12",
    readMinutes: 3,
    title: {
      id: "Berapa Sebenarnya Pengeluaran Bulananmu untuk Langganan?",
      en: "What's Your Actual Monthly Subscription Spending?",
    },
    excerpt: {
      id: "Langganan mingguan, bulanan, dan tahunan susah dibandingkan langsung. Ini cara menyamakannya biar kelihatan gambaran yang sebenarnya.",
      en: "Weekly, monthly, and yearly billing cycles are hard to compare directly. Here's how to normalize them so you see the real picture.",
    },
    body: {
      id: [
        "Salah satu alasan total pengeluaran langganan susah kebayang: siklus tagihannya beda-beda. Ada yang mingguan, bulanan, ada yang tahunan sekali bayar — dan otak nggak otomatis menyamakan itu semua ke satu angka bulanan.",
        "## Kenapa langganan tahunan sering \"kelupaan\"",
        "Langganan yang dibayar sekali setahun terasa kecil dampaknya harian, tapi kalau dipecah per bulan, angkanya bisa lebih besar dari yang dikira. Karena tagihannya cuma muncul sekali setahun, gampang nggak masuk hitungan pengeluaran bulanan biasa.",
        "## Cara menyamakan semua siklus ke angka bulanan",
        "Rumusnya sederhana: mingguan dikali ~4.33, tahunan dibagi 12. Setelah semua siklus disamakan ke basis bulanan, baru kelihatan total yang sebenarnya — dan mana yang porsinya paling besar.",
        "## Bandingkan dengan yang benar-benar dipakai",
        "Total angka doang belum cukup. Langkah berikutnya: bandingkan biaya per bulan dengan seberapa sering benar-benar dipakai. Langganan mahal yang dipakai tiap hari beda cerita dengan langganan murah yang nggak pernah dibuka.",
        "## Proyeksi ke depan, bukan cuma bulan ini",
        "Kalau ada langganan baru yang mau ditambah, cek dulu proyeksi bulan depan setelah ditambahkan — biar keputusannya berdasarkan gambaran penuh, bukan cuma angka bulan ini yang kebetulan masih kelihatan aman.",
      ],
      en: [
        "One reason total subscription spend is hard to picture: billing cycles differ. Some are weekly, some monthly, some billed once a year — and it's not automatic to translate all of that into one comparable monthly figure.",
        "## Why yearly subscriptions get overlooked",
        "A subscription billed once a year feels small day to day, but broken down monthly it can be bigger than expected. Because the charge only shows up once a year, it's easy for it to slip out of the usual monthly-spending mental math.",
        "## Normalizing every cycle to a monthly figure",
        "The math is simple: weekly × ~4.33, yearly ÷ 12. Once every cycle is normalized to a monthly basis, the real total becomes visible — along with which one actually takes the biggest share.",
        "## Compare against what's actually used",
        "The total number alone isn't enough. The next step: compare monthly cost against how often it's actually used. An expensive subscription used daily is a different story than a cheap one that's never opened.",
        "## Project forward, not just this month",
        "Before adding a new subscription, check next month's projection with it included — so the decision is based on the full picture, not just this month's number that happens to still look safe.",
      ],
    },
  },
  {
    slug: "patungan-netflix-spotify-adil",
    publishedAt: "2026-09-16",
    readMinutes: 4,
    title: {
      id: "Patungan Netflix/Spotify Bareng Teman: Cara Adil Bagi Tagihan",
      en: "Splitting Netflix/Spotify With Friends: How to Divide It Fairly",
    },
    excerpt: {
      id: "Patungan langganan hemat, tapi sering berantakan soal siapa udah bayar dan siapa belum. Ini pola yang biasanya bikin patungan tetap rukun.",
      en: "Sharing a subscription saves money, but tracking who's paid and who hasn't often turns messy. Here's what tends to keep group billing drama-free.",
    },
    body: {
      id: [
        "Patungan langganan streaming atau musik bareng keluarga/teman itu masuk akal secara hitungan — tapi bagian yang sering bikin canggung bukan soal uangnya, melainkan soal transparansi siapa yang udah bayar.",
        "## Pilih: rata sama besar, atau proporsional?",
        "Split rata paling gampang dihitung dan cocok kalau semua anggota pakai kurang lebih sama. Split custom (misal si pemilik akun bayar porsi lebih besar karena juga pakai buat kerja) lebih adil kalau pemakaiannya jomplang — tapi butuh kesepakatan di awal, bukan didebat tiap bulan.",
        "## Catat per periode tagihan, bukan cuma sekali di awal",
        "Status \"udah bayar\" itu berubah tiap periode, bukan status permanen. Tanpa pencatatan per periode, gampang lupa: bulan lalu udah bayar apa belum?",
        "## Satu orang koordinator, tapi transparan buat semua",
        "Biasanya ada satu orang yang pegang akun & bayar ke penyedia layanan duluan, lalu anggota lain reimburse. Supaya nggak jadi beban sepihak buat nagih terus, semua anggota idealnya bisa lihat sendiri status siapa yang belum bayar — bukan cuma si koordinator yang tahu.",
        "## Ingatkan dengan sopan, bukan menagih berulang di chat pribadi",
        "Pengingat otomatis buat anggota yang belum bayar jauh lebih nyaman buat kedua pihak dibanding koordinator harus japri manual tiap bulan.",
      ],
      en: [
        "Sharing a streaming or music subscription with family or friends makes sense on paper — but the part that usually gets awkward isn't the money itself, it's transparency about who's actually paid.",
        "## Equal split, or proportional?",
        "An equal split is the simplest to calculate and works well when everyone uses it roughly the same amount. A custom split (say, the account owner pays a larger share since they also use it for work) is fairer when usage is lopsided — but it needs to be agreed on upfront, not re-argued every month.",
        "## Track it per billing period, not just once at the start",
        "\"Paid\" status changes every period, it's not a permanent state. Without per-period tracking, it's easy to lose track: did they pay last month or not?",
        "## One coordinator, but visible to everyone",
        "Usually one person holds the account and pays the provider upfront, then others reimburse them. So it doesn't become that one person's job to keep chasing everyone, it helps if every member can see who's still unpaid themselves — not just the coordinator.",
        "## Nudge politely, not repeated one-on-one chasing",
        "An automatic reminder for members who haven't paid is far more comfortable for everyone involved than the coordinator having to DM people manually every month.",
      ],
    },
  },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}

export function listPosts(): BlogPost[] {
  return [...blogPosts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
