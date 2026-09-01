// Quick-pick presets for popular services in Indonesia.
// Prices are common defaults (editable by the user after selecting).

import { CategoryKey } from "./categories";

export interface ServicePreset {
  name: string;
  category: CategoryKey;
  price: number;
  cycle: "weekly" | "monthly" | "yearly";
  icon: string; // MaterialCommunityIcons
  color: string;
}

export const PRESETS: ServicePreset[] = [
  { name: "Netflix", category: "entertainment", price: 186000, cycle: "monthly", icon: "netflix", color: "#E50914" },
  { name: "Spotify", category: "music", price: 54990, cycle: "monthly", icon: "spotify", color: "#1DB954" },
  { name: "YouTube Premium", category: "entertainment", price: 59000, cycle: "monthly", icon: "youtube", color: "#FF0000" },
  { name: "Disney+ Hotstar", category: "entertainment", price: 39000, cycle: "monthly", icon: "movie-open", color: "#0E47BB" },
  { name: "Vidio", category: "entertainment", price: 49000, cycle: "monthly", icon: "play-circle", color: "#ED1B24" },
  { name: "Prime Video", category: "entertainment", price: 59000, cycle: "monthly", icon: "filmstrip", color: "#00A8E1" },
  { name: "Viu", category: "entertainment", price: 30000, cycle: "monthly", icon: "television-play", color: "#FFC400" },
  { name: "iQIYI", category: "entertainment", price: 49000, cycle: "monthly", icon: "television-classic", color: "#00CC36" },
  { name: "Apple Music", category: "music", price: 69000, cycle: "monthly", icon: "apple", color: "#FA243C" },
  { name: "ChatGPT Plus", category: "productivity", price: 330000, cycle: "monthly", icon: "robot", color: "#10A37F" },
  { name: "Canva Pro", category: "productivity", price: 95000, cycle: "monthly", icon: "palette", color: "#8B3DFF" },
  { name: "iCloud+", category: "cloud", price: 15000, cycle: "monthly", icon: "apple-icloud", color: "#3693F3" },
  { name: "Google One", category: "cloud", price: 26900, cycle: "monthly", icon: "google-drive", color: "#4285F4" },
  { name: "Microsoft 365", category: "productivity", price: 96000, cycle: "monthly", icon: "microsoft-office", color: "#D83B01" },
  { name: "Xbox Game Pass", category: "gaming", price: 76000, cycle: "monthly", icon: "microsoft-xbox", color: "#107C10" },
  { name: "CapCut Pro", category: "productivity", price: 120000, cycle: "monthly", icon: "movie-edit", color: "#111111" },
];
