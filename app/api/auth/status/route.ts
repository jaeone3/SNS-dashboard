import { NextResponse } from "next/server";
import { hasLoginSession } from "@/lib/scraper";

/**
 * GET /api/auth/status
 * Returns login session status for each platform.
 */
export async function GET() {
  return NextResponse.json({
    instagram: hasLoginSession("instagram"),
    facebook: hasLoginSession("facebook"),
  });
}
