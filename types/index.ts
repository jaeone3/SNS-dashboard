// ===== Region (Country) =====
export interface Region {
  code: string; // "KR", "US", "JP"
  name: string; // "Korea"
  flagEmoji: string; // "🇰🇷"
  languageIds: string[]; // -> Language.id[] — which languages belong to this region
}

// ===== Language (Tab) =====
export interface Language {
  id: string;
  code: string; // "EN", "JP", "SP", "CN"
  label: string; // "English"
  countryCode: string; // ISO country code for flag — "US", "JP", "ES", "CN"
  sortOrder: number;
}

// ===== Platform =====
export interface Platform {
  id: string;
  name: string; // "tiktok" (lowercase, unique key)
  displayName: string; // "TikTok"
  iconName: string; // lucide-react icon name or custom identifier
  profileUrlTemplate: string; // e.g. "https://www.tiktok.com/@{username}"
}

// ===== Tag (ETC column) =====
export interface Tag {
  id: string;
  label: string; // "#Shadowban"
  color: string; // hex "#ef4444"
}

// ===== SNS Account (main entity) =====
export interface Account {
  id: string;
  platformId: string; // -> Platform.id
  username: string; // platform @username
  displayName: string | null; // user-friendly name shown in dashboard
  regionCode: string; // -> Region.code
  languageCode: string; // -> Language.code

  // Latest post metrics (manual input)
  followers: number | null;
  lastPostDate: string | null; // "YYYY-MM-DD"
  lastPostView: number | null;
  lastPostLike: number | null;
  lastPostSave: number | null;

  // Tags
  tagIds: string[]; // -> Tag.id[]

  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}
