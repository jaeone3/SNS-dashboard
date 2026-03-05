import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { label, color } = body as { label: string; color: string };

    if (!label || !color) {
      return NextResponse.json(
        { error: "label and color are required" },
        { status: 400 }
      );
    }

    const id = body.id as string | undefined;
    const tag = await prisma.tag.create({
      data: { ...(id ? { id } : {}), label, color },
    });

    return NextResponse.json({
      id: tag.id,
      label: tag.label,
      color: tag.color,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create tag: ${message}` },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, label, color } = body as {
      id: string;
      label?: string;
      color?: string;
    };

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const data: Record<string, string> = {};
    if (label !== undefined) data.label = label;
    if (color !== undefined) data.color = color;

    const tag = await prisma.tag.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      id: tag.id,
      label: tag.label,
      color: tag.color,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to update tag: ${message}` },
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

    await prisma.tag.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to delete tag: ${message}` },
      { status: 500 }
    );
  }
}
