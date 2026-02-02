import { NextRequest, NextResponse } from "next/server";
import {
  openLoginBrowser,
  closeLoginBrowser,
  closeLoggedInBrowser,
} from "@/lib/scraper";

/**
 * POST /api/auth/login
 * Opens a visible browser for manual login.
 * Body: { platform: "instagram" | "facebook" }
 */
export async function POST(request: NextRequest) {
  try {
    const { platform } = (await request.json()) as { platform: string };

    if (!platform || !["instagram", "facebook"].includes(platform)) {
      return NextResponse.json(
        { error: 'platform must be "instagram" or "facebook"' },
        { status: 400 }
      );
    }

    // Close any existing scraping browser for this platform first
    await closeLoggedInBrowser(platform);

    // Open visible browser for login
    await openLoginBrowser(platform);

    return NextResponse.json({
      status: "browser_opened",
      message: `${platform} login browser opened. Please log in manually, then call DELETE to close.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/auth/login
 * Closes the login browser and saves the session.
 * Body: { platform: "instagram" | "facebook" }
 */
export async function DELETE(request: NextRequest) {
  try {
    const { platform } = (await request.json()) as { platform: string };

    if (!platform || !["instagram", "facebook"].includes(platform)) {
      return NextResponse.json(
        { error: 'platform must be "instagram" or "facebook"' },
        { status: 400 }
      );
    }

    await closeLoginBrowser(platform);

    return NextResponse.json({
      status: "closed",
      message: `${platform} login browser closed. Session saved.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
