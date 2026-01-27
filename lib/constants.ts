import type { Region, Language, Platform, Tag, Account } from "@/types";

export const SEED_LANGUAGES: Language[] = [
  { id: "lang-en", code: "EN", label: "English", countryCode: "US", sortOrder: 0 },
  { id: "lang-jp", code: "JP", label: "Japanese", countryCode: "JP", sortOrder: 1 },
  { id: "lang-sp", code: "SP", label: "Spanish", countryCode: "ES", sortOrder: 2 },
  { id: "lang-cn", code: "CN", label: "Chinese", countryCode: "CN", sortOrder: 3 },
];

export const SEED_REGIONS: Region[] = [
  {
    code: "KR",
    name: "Korea",
    flagEmoji: "🇰🇷",
    languageIds: ["lang-en", "lang-jp", "lang-sp", "lang-cn"],
  },
  {
    code: "US",
    name: "United States",
    flagEmoji: "🇺🇸",
    languageIds: ["lang-en", "lang-sp"],
  },
  {
    code: "JP",
    name: "Japan",
    flagEmoji: "🇯🇵",
    languageIds: ["lang-en", "lang-jp"],
  },
];

export const SEED_PLATFORMS: Platform[] = [
  {
    id: "plt-tiktok",
    name: "tiktok",
    displayName: "TikTok",
    iconName: "tiktok",
    profileUrlTemplate: "https://www.tiktok.com/@{username}",
  },
  {
    id: "plt-instagram",
    name: "instagram",
    displayName: "Instagram",
    iconName: "instagram",
    profileUrlTemplate: "https://www.instagram.com/{username}",
  },
  {
    id: "plt-youtube",
    name: "youtube",
    displayName: "YouTube",
    iconName: "youtube",
    profileUrlTemplate: "https://www.youtube.com/@{username}",
  },
  {
    id: "plt-facebook",
    name: "facebook",
    displayName: "Facebook",
    iconName: "facebook",
    profileUrlTemplate: "https://www.facebook.com/{username}",
  },
];

export const SEED_TAGS: Tag[] = [
  { id: "tag-shadowban", label: "#Shadowban", color: "#ef4444" },
  { id: "tag-viral", label: "#Viral", color: "#22c55e" },
  { id: "tag-inactive", label: "#Inactive", color: "#6b7280" },
];

const SEED_TIMESTAMP = "2025-01-27T00:00:00.000Z";

const _acc = (
  id: string,
  platformId: string,
  username: string,
  regionCode = "KR",
  languageCode = "EN"
): Account => ({
  id,
  platformId,
  username,
  regionCode,
  languageCode,
  followers: null,
  lastPostDate: null,
  lastPostView: null,
  lastPostLike: null,
  lastPostSave: null,
  tagIds: [],
  createdAt: SEED_TIMESTAMP,
  updatedAt: SEED_TIMESTAMP,
});

export const SEED_ACCOUNTS: Account[] = [
  // ===== TikTok (9) =====
  _acc("acc-tt-1", "plt-tiktok", "korean_haru"),
  _acc("acc-tt-2", "plt-tiktok", "kcontentseveryday"),
  _acc("acc-tt-3", "plt-tiktok", "dailykcontents"),
  _acc("acc-tt-4", "plt-tiktok", "korean_is_easy5"),
  _acc("acc-tt-5", "plt-tiktok", "koko_free18"),
  _acc("acc-tt-6", "plt-tiktok", "koko_korean_speaking"),
  _acc("acc-tt-7", "plt-tiktok", "teachkoreaneveryday"),
  _acc("acc-tt-8", "plt-tiktok", "koko_so061"),
  _acc("acc-tt-9", "plt-tiktok", "koko_yc"),

  // ===== Instagram (6) =====
  _acc("acc-ig-1", "plt-instagram", "koko_real_conv"),
  _acc("acc-ig-2", "plt-instagram", "koko.ai_ro"),
  _acc("acc-ig-3", "plt-instagram", "real_korean_koko"),
  _acc("acc-ig-4", "plt-instagram", "koko_contents"),
  _acc("acc-ig-5", "plt-instagram", "learn_kor_everyday"),
  _acc("acc-ig-6", "plt-instagram", "kcontents_everyday"),

  // ===== Facebook (6) =====
  _acc("acc-fb-1", "plt-facebook", "DelpKorean"),
  _acc("acc-fb-2", "plt-facebook", "LearnKoreaneasily"),
  _acc("acc-fb-3", "plt-facebook", "KokoKorean"),
  _acc("acc-fb-4", "plt-facebook", "Snu_d-school"),
  _acc("acc-fb-5", "plt-facebook", "Easykorean"),
  _acc("acc-fb-6", "plt-facebook", "ZEFIT"),

  // ===== YouTube (1) =====
  _acc("acc-yt-1", "plt-youtube", "easy_korean_everyday"),
];
