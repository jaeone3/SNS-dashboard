import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, name, flagEmoji } = body as {
      code: string;
      name: string;
      flagEmoji: string;
    };

    if (!code || !name || !flagEmoji) {
      return NextResponse.json(
        { error: "code, name, and flagEmoji are required" },
        { status: 400 }
      );
    }

    const region = await prisma.region.create({
      data: { code, name, flagEmoji },
      include: { languages: { select: { languageId: true } } },
    });

    return NextResponse.json({
      code: region.code,
      name: region.name,
      flagEmoji: region.flagEmoji,
      languageIds: region.languages.map((l) => l.languageId),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create region: ${message}` },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { code } = body as { code: string };

    if (!code) {
      return NextResponse.json(
        { error: "code is required" },
        { status: 400 }
      );
    }

    await prisma.region.delete({ where: { code } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to delete region: ${message}` },
      { status: 500 }
    );
  }
}
