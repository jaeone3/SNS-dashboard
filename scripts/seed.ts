import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// --- Seed Data (mirrors lib/constants.ts) ---

const SEED_LANGUAGES = [
  { id: "lang-en", code: "EN", label: "English", countryCode: "US", sortOrder: 0 },
  { id: "lang-jp", code: "JP", label: "Japanese", countryCode: "JP", sortOrder: 1 },
  { id: "lang-sp", code: "SP", label: "Spanish", countryCode: "ES", sortOrder: 2 },
  { id: "lang-cn", code: "CN", label: "Chinese", countryCode: "CN", sortOrder: 3 },
];

const SEED_REGIONS = [
  { code: "KR", name: "Korea", flagEmoji: "🇰🇷", languageIds: ["lang-en", "lang-jp", "lang-sp", "lang-cn"] },
  { code: "US", name: "United States", flagEmoji: "🇺🇸", languageIds: ["lang-en", "lang-sp"] },
  { code: "JP", name: "Japan", flagEmoji: "🇯🇵", languageIds: ["lang-en", "lang-jp"] },
];

const SEED_PLATFORMS = [
  { id: "plt-tiktok", name: "tiktok", displayName: "TikTok", iconName: "tiktok", profileUrlTemplate: "https://www.tiktok.com/@{username}" },
  { id: "plt-instagram", name: "instagram", displayName: "Instagram", iconName: "instagram", profileUrlTemplate: "https://www.instagram.com/{username}" },
  { id: "plt-youtube", name: "youtube", displayName: "YouTube", iconName: "youtube", profileUrlTemplate: "https://www.youtube.com/@{username}" },
  { id: "plt-facebook", name: "facebook", displayName: "Facebook", iconName: "facebook", profileUrlTemplate: "https://www.facebook.com/{username}" },
];

const SEED_TAGS = [
  { id: "tag-shadowban", label: "#Shadowban", color: "#ef4444" },
  { id: "tag-trending", label: "#Trending", color: "#22c55e" },
  { id: "tag-new", label: "#New", color: "#3b82f6" },
];

async function main() {
  // Idempotent check
  const existingRegions = await prisma.region.count();
  if (existingRegions > 0) {
    console.log("Database already seeded, skipping.");
    return;
  }

  console.log("Seeding database...");

  // 1. Languages
  for (const lang of SEED_LANGUAGES) {
    await prisma.language.upsert({
      where: { id: lang.id },
      update: {},
      create: lang,
    });
  }
  console.log(`  ✓ ${SEED_LANGUAGES.length} languages`);

  // 2. Regions + RegionLanguage joins
  for (const region of SEED_REGIONS) {
    await prisma.region.upsert({
      where: { code: region.code },
      update: {},
      create: { code: region.code, name: region.name, flagEmoji: region.flagEmoji },
    });
    for (const languageId of region.languageIds) {
      await prisma.regionLanguage.upsert({
        where: { regionCode_languageId: { regionCode: region.code, languageId } },
        update: {},
        create: { regionCode: region.code, languageId },
      });
    }
  }
  console.log(`  ✓ ${SEED_REGIONS.length} regions`);

  // 3. Platforms
  const platformIdMap = new Map<string, string>();
  for (const platform of SEED_PLATFORMS) {
    const created = await prisma.platform.upsert({
      where: { name: platform.name },
      update: {},
      create: { name: platform.name, displayName: platform.displayName, iconName: platform.iconName, profileUrlTemplate: platform.profileUrlTemplate },
    });
    platformIdMap.set(platform.id, created.id);
  }
  console.log(`  ✓ ${SEED_PLATFORMS.length} platforms`);

  // 4. Tags
  const tagIdMap = new Map<string, string>();
  for (const tag of SEED_TAGS) {
    const created = await prisma.tag.upsert({
      where: { label: tag.label },
      update: {},
      create: { label: tag.label, color: tag.color },
    });
    tagIdMap.set(tag.id, created.id);
  }
  console.log(`  ✓ ${SEED_TAGS.length} tags`);

  console.log("\nSeed complete!");
  console.log("Platform ID mapping:", Object.fromEntries(platformIdMap));
  console.log("Tag ID mapping:", Object.fromEntries(tagIdMap));
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
