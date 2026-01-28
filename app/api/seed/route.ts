import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  SEED_REGIONS,
  SEED_LANGUAGES,
  SEED_PLATFORMS,
  SEED_TAGS,
  SEED_ACCOUNTS,
} from "@/lib/constants";

export async function POST() {
  try {
    // Idempotent check: skip if regions already exist
    const existingRegions = await prisma.region.count();
    if (existingRegions > 0) {
      return NextResponse.json({
        message: "Database already seeded, skipping.",
        seeded: false,
      });
    }

    // 1. Create Languages
    for (const lang of SEED_LANGUAGES) {
      await prisma.language.upsert({
        where: { id: lang.id },
        update: {},
        create: {
          id: lang.id,
          code: lang.code,
          label: lang.label,
          countryCode: lang.countryCode,
          sortOrder: lang.sortOrder,
        },
      });
    }

    // 2. Create Regions + RegionLanguage joins
    for (const region of SEED_REGIONS) {
      await prisma.region.upsert({
        where: { code: region.code },
        update: {},
        create: {
          code: region.code,
          name: region.name,
          flagEmoji: region.flagEmoji,
        },
      });

      // Create RegionLanguage joins
      for (const languageId of region.languageIds) {
        await prisma.regionLanguage.upsert({
          where: {
            regionCode_languageId: {
              regionCode: region.code,
              languageId,
            },
          },
          update: {},
          create: {
            regionCode: region.code,
            languageId,
          },
        });
      }
    }

    // 3. Create Platforms — store mapping from seed ID to actual UUID
    const platformIdMap = new Map<string, string>();
    for (const platform of SEED_PLATFORMS) {
      const created = await prisma.platform.upsert({
        where: { name: platform.name },
        update: {},
        create: {
          name: platform.name,
          displayName: platform.displayName,
          iconName: platform.iconName,
          profileUrlTemplate: platform.profileUrlTemplate,
        },
      });
      platformIdMap.set(platform.id, created.id);
    }

    // 4. Create Tags — store mapping from seed ID to actual UUID
    const tagIdMap = new Map<string, string>();
    for (const tag of SEED_TAGS) {
      const created = await prisma.tag.upsert({
        where: { label: tag.label },
        update: {},
        create: {
          label: tag.label,
          color: tag.color,
        },
      });
      tagIdMap.set(tag.id, created.id);
    }

    // 5. Create Accounts
    for (const account of SEED_ACCOUNTS) {
      const actualPlatformId = platformIdMap.get(account.platformId);
      if (!actualPlatformId) {
        console.warn(`Platform not found for seed ID: ${account.platformId}`);
        continue;
      }

      const created = await prisma.account.upsert({
        where: {
          platformId_username: {
            platformId: actualPlatformId,
            username: account.username,
          },
        },
        update: {},
        create: {
          platformId: actualPlatformId,
          username: account.username,
          regionCode: account.regionCode,
          languageCode: account.languageCode,
          followers: account.followers,
          lastPostDate: account.lastPostDate,
          lastPostView: account.lastPostView,
          lastPostLike: account.lastPostLike,
          lastPostSave: account.lastPostSave,
        },
      });

      // Create AccountTag joins if any
      for (const seedTagId of account.tagIds) {
        const actualTagId = tagIdMap.get(seedTagId);
        if (actualTagId) {
          await prisma.accountTag.upsert({
            where: {
              accountId_tagId: {
                accountId: created.id,
                tagId: actualTagId,
              },
            },
            update: {},
            create: {
              accountId: created.id,
              tagId: actualTagId,
            },
          });
        }
      }
    }

    return NextResponse.json({
      message: "Database seeded successfully.",
      seeded: true,
      counts: {
        languages: SEED_LANGUAGES.length,
        regions: SEED_REGIONS.length,
        platforms: SEED_PLATFORMS.length,
        tags: SEED_TAGS.length,
        accounts: SEED_ACCOUNTS.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to seed database: ${message}` },
      { status: 500 }
    );
  }
}
