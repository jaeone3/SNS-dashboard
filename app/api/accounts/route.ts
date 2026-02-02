import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { platformId, username, displayName, regionCode, languageCode } = body as {
      platformId: string;
      username: string;
      displayName?: string;
      regionCode: string;
      languageCode: string;
    };

     if (!platformId || !username || !regionCode || !languageCode) {
       return NextResponse.json(
         { error: "platformId, username, regionCode, and languageCode are required" },
         { status: 400 }
       );
     }

     const [platformExists, regionExists, languageExists] = await Promise.all([
       prisma.platform.findUnique({ where: { id: platformId }, select: { id: true } }),
       prisma.region.findUnique({ where: { code: regionCode }, select: { code: true } }),
       prisma.language.findUnique({ where: { code: languageCode }, select: { code: true } }),
     ]);

     if (!platformExists) {
       return NextResponse.json({ error: "Platform not found" }, { status: 400 });
     }
     if (!regionExists) {
       return NextResponse.json({ error: "Region not found" }, { status: 400 });
     }
     if (!languageExists) {
       return NextResponse.json({ error: "Language not found" }, { status: 400 });
     }

     const account = await prisma.account.create({
      data: {
        ...(body.id ? { id: body.id } : {}),
        platformId,
        username,
        displayName: displayName || null,
        regionCode,
        languageCode,
        followers: body.followers ?? null,
        lastPostDate: body.lastPostDate ?? null,
        lastPostView: body.lastPostView ?? null,
        lastPostLike: body.lastPostLike ?? null,
        lastPostSave: body.lastPostSave ?? null,
      },
      include: { tags: { select: { tagId: true } } },
    });

    return NextResponse.json({
      id: account.id,
      platformId: account.platformId,
      username: account.username,
      displayName: account.displayName,
      regionCode: account.regionCode,
      languageCode: account.languageCode,
      followers: account.followers,
      lastPostDate: account.lastPostDate,
      lastPostView: account.lastPostView,
      lastPostLike: account.lastPostLike,
      lastPostSave: account.lastPostSave,
      tagIds: account.tags.map((t) => t.tagId),
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("[POST /api/accounts] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create account: ${message}` },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...data } = body as {
      id: string;
      platformId?: string;
      username?: string;
      displayName?: string | null;
      regionCode?: string;
      languageCode?: string;
      followers?: number | null;
      lastPostDate?: string | null;
      lastPostView?: number | null;
      lastPostLike?: number | null;
      lastPostSave?: number | null;
    };

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const account = await prisma.account.update({
      where: { id },
      data,
      include: { tags: { select: { tagId: true } } },
    });

    return NextResponse.json({
      id: account.id,
      platformId: account.platformId,
      username: account.username,
      displayName: account.displayName,
      regionCode: account.regionCode,
      languageCode: account.languageCode,
      followers: account.followers,
      lastPostDate: account.lastPostDate,
      lastPostView: account.lastPostView,
      lastPostLike: account.lastPostLike,
      lastPostSave: account.lastPostSave,
      tagIds: account.tags.map((t) => t.tagId),
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to update account: ${message}` },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { id } = body as { id: string };

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    await prisma.account.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to delete account: ${message}` },
      { status: 500 }
    );
  }
}
