import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

interface SeedAccount {
  seedPlatformId: string;
  username: string;
  regionCode: string;
  languageCode: string;
}

const SEED_ACCOUNTS: SeedAccount[] = [
  // ===== TikTok (9) =====
  { seedPlatformId: "plt-tiktok", username: "korean_haru", regionCode: "KR", languageCode: "EN" },
  { seedPlatformId: "plt-tiktok", username: "kcontentseveryday", regionCode: "KR", languageCode: "EN" },
  { seedPlatformId: "plt-tiktok", username: "dailykcontents", regionCode: "KR", languageCode: "EN" },
  { seedPlatformId: "plt-tiktok", username: "korean_is_easy5", regionCode: "KR", languageCode: "EN" },
  { seedPlatformId: "plt-tiktok", username: "koko_free18", regionCode: "KR", languageCode: "EN" },
  { seedPlatformId: "plt-tiktok", username: "koko_korean_speaking", regionCode: "KR", languageCode: "EN" },
  { seedPlatformId: "plt-tiktok", username: "teachkoreaneveryday", regionCode: "KR", languageCode: "EN" },
  { seedPlatformId: "plt-tiktok", username: "koko_so061", regionCode: "KR", languageCode: "EN" },
  { seedPlatformId: "plt-tiktok", username: "koko_yc", regionCode: "KR", languageCode: "EN" },

  // ===== Instagram (6) =====
  { seedPlatformId: "plt-instagram", username: "koko_real_conv", regionCode: "KR", languageCode: "EN" },
  { seedPlatformId: "plt-instagram", username: "koko.ai_ro", regionCode: "KR", languageCode: "EN" },
  { seedPlatformId: "plt-instagram", username: "real_korean_koko", regionCode: "KR", languageCode: "EN" },
  { seedPlatformId: "plt-instagram", username: "koko_contents", regionCode: "KR", languageCode: "EN" },
  { seedPlatformId: "plt-instagram", username: "learn_kor_everyday", regionCode: "KR", languageCode: "EN" },
  { seedPlatformId: "plt-instagram", username: "kcontents_everyday", regionCode: "KR", languageCode: "EN" },

  // ===== Facebook (6) =====
  { seedPlatformId: "plt-facebook", username: "61565488769929", regionCode: "KR", languageCode: "EN" },
  { seedPlatformId: "plt-facebook", username: "LearnKoreaneasily", regionCode: "KR", languageCode: "EN" },
  { seedPlatformId: "plt-facebook", username: "KokoKorean", regionCode: "KR", languageCode: "EN" },
  { seedPlatformId: "plt-facebook", username: "61551627689772", regionCode: "KR", languageCode: "EN" },
  { seedPlatformId: "plt-facebook", username: "Easykorean", regionCode: "KR", languageCode: "EN" },
  { seedPlatformId: "plt-facebook", username: "ZEFIT", regionCode: "KR", languageCode: "EN" },

  // ===== YouTube (1) =====
  { seedPlatformId: "plt-youtube", username: "easy_korean_everyday", regionCode: "KR", languageCode: "EN" },
];

// Map seed platform IDs to platform names for lookup
const SEED_PLATFORM_NAME_MAP: Record<string, string> = {
  "plt-tiktok": "tiktok",
  "plt-instagram": "instagram",
  "plt-youtube": "youtube",
  "plt-facebook": "facebook",
};

async function main() {
  // Get actual platform IDs from DB
  const platforms = await prisma.platform.findMany();
  const platformMap = new Map(platforms.map((p) => [p.name, p.id]));

  console.log("Seeding accounts...");

  let created = 0;
  let skipped = 0;

  for (const acc of SEED_ACCOUNTS) {
    const platformName = SEED_PLATFORM_NAME_MAP[acc.seedPlatformId];
    const actualPlatformId = platformMap.get(platformName);
    if (!actualPlatformId) {
      console.warn(`  ⚠ Platform not found: ${platformName}`);
      skipped++;
      continue;
    }

    try {
      await prisma.account.upsert({
        where: {
          platformId_username: {
            platformId: actualPlatformId,
            username: acc.username,
          },
        },
        update: {},
        create: {
          platformId: actualPlatformId,
          username: acc.username,
          regionCode: acc.regionCode,
          languageCode: acc.languageCode,
        },
      });
      created++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`  ⚠ Failed to create ${acc.username}: ${msg}`);
      skipped++;
    }
  }

  console.log(`\n✓ ${created} accounts created, ${skipped} skipped`);
}

main()
  .catch((e) => {
    console.error("Seed accounts failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
