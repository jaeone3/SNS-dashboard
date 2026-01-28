import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { languageId } = body as { languageId: string };

    if (!languageId) {
      return NextResponse.json(
        { error: "languageId is required" },
        { status: 400 }
      );
    }

    await prisma.regionLanguage.create({
      data: { regionCode: code, languageId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to assign language to region: ${message}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { languageId } = body as { languageId: string };

    if (!languageId) {
      return NextResponse.json(
        { error: "languageId is required" },
        { status: 400 }
      );
    }

    await prisma.regionLanguage.delete({
      where: {
        regionCode_languageId: { regionCode: code, languageId },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to unassign language from region: ${message}` },
      { status: 500 }
    );
  }
}
