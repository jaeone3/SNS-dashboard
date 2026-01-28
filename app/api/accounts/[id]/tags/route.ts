import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { tagId } = body as { tagId: string };

    if (!tagId) {
      return NextResponse.json(
        { error: "tagId is required" },
        { status: 400 }
      );
    }

    await prisma.accountTag.create({
      data: { accountId: id, tagId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to assign tag: ${message}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { tagId } = body as { tagId: string };

    if (!tagId) {
      return NextResponse.json(
        { error: "tagId is required" },
        { status: 400 }
      );
    }

    await prisma.accountTag.delete({
      where: {
        accountId_tagId: { accountId: id, tagId },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to unassign tag: ${message}` },
      { status: 500 }
    );
  }
}
