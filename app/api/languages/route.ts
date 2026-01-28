import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, label, countryCode, sortOrder } = body as {
      code: string;
      label: string;
      countryCode: string;
      sortOrder?: number;
    };

    if (!code || !label || !countryCode) {
      return NextResponse.json(
        { error: "code, label, and countryCode are required" },
        { status: 400 }
      );
    }

    const id = body.id as string | undefined;
    const language = await prisma.language.create({
      data: {
        ...(id ? { id } : {}),
        code,
        label,
        countryCode,
        sortOrder: sortOrder ?? 0,
      },
    });

    return NextResponse.json({
      id: language.id,
      code: language.code,
      label: language.label,
      countryCode: language.countryCode,
      sortOrder: language.sortOrder,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create language: ${message}` },
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

    await prisma.language.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to delete language: ${message}` },
      { status: 500 }
    );
  }
}
