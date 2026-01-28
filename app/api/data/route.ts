import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const [dbRegions, dbLanguages, dbPlatforms, dbTags, dbAccounts] =
      await Promise.all([
        prisma.region.findMany({
          include: { languages: { select: { languageId: true } } },
        }),
        prisma.language.findMany({ orderBy: { sortOrder: "asc" } }),
        prisma.platform.findMany(),
        prisma.tag.findMany(),
        prisma.account.findMany({
          include: { tags: { select: { tagId: true } } },
        }),
      ]);

    const regions = dbRegions.map((r) => ({
      code: r.code,
      name: r.name,
      flagEmoji: r.flagEmoji,
      languageIds: r.languages.map((l) => l.languageId),
    }));

    const languages = dbLanguages.map((l) => ({
      id: l.id,
      code: l.code,
      label: l.label,
      countryCode: l.countryCode,
      sortOrder: l.sortOrder,
    }));

    const platforms = dbPlatforms.map((p) => ({
      id: p.id,
      name: p.name,
      displayName: p.displayName,
      iconName: p.iconName,
      profileUrlTemplate: p.profileUrlTemplate,
    }));

    const tags = dbTags.map((t) => ({
      id: t.id,
      label: t.label,
      color: t.color,
    }));

    const accounts = dbAccounts.map((a) => ({
      id: a.id,
      platformId: a.platformId,
      username: a.username,
      regionCode: a.regionCode,
      languageCode: a.languageCode,
      followers: a.followers,
      lastPostDate: a.lastPostDate,
      lastPostView: a.lastPostView,
      lastPostLike: a.lastPostLike,
      lastPostSave: a.lastPostSave,
      tagIds: a.tags.map((t) => t.tagId),
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      regions,
      languages,
      platforms,
      tags,
      accounts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch data: ${message}` },
      { status: 500 }
    );
  }
}
