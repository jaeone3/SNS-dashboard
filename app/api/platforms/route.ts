import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, displayName, iconName, profileUrlTemplate } = body as {
      name: string;
      displayName: string;
      iconName: string;
      profileUrlTemplate: string;
    };

    if (!name || !displayName || !iconName || !profileUrlTemplate) {
      return NextResponse.json(
        { error: "name, displayName, iconName, and profileUrlTemplate are required" },
        { status: 400 }
      );
    }

    const id = body.id as string | undefined;
    const platform = await prisma.platform.create({
      data: { ...(id ? { id } : {}), name, displayName, iconName, profileUrlTemplate },
    });

    return NextResponse.json({
      id: platform.id,
      name: platform.name,
      displayName: platform.displayName,
      iconName: platform.iconName,
      profileUrlTemplate: platform.profileUrlTemplate,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create platform: ${message}` },
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

    await prisma.platform.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to delete platform: ${message}` },
      { status: 500 }
    );
  }
}
