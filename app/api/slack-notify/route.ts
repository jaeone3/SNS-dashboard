import { NextRequest, NextResponse } from "next/server";
import { sendSlackMessage } from "@/lib/slack-notifier";

/**
 * POST /api/slack-notify
 * Send a Slack notification with a text message
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = body as { text: string };

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "text field is required" },
        { status: 400 }
      );
    }

    await sendSlackMessage(text);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[API] Failed to send Slack notification:", error);
    return NextResponse.json(
      { error: `Failed to send Slack notification: ${message}` },
      { status: 500 }
    );
  }
}
