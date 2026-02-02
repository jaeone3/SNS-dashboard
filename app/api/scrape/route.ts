import { NextRequest, NextResponse } from "next/server";
import {
  scrapeTikTok,
  scrapeInstagram,
  scrapeYouTube,
  scrapeFacebook,
} from "@/lib/scraper";
import type { ScrapeResult } from "@/lib/scraper";

export type { ScrapeResult };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform, username } = body as {
      platform: string;
      username: string;
    };

    if (!platform || !username) {
      return NextResponse.json(
        { error: "platform and username are required" },
        { status: 400 }
      );
    }

    let result: ScrapeResult;

    switch (platform.toLowerCase()) {
      case "tiktok":
        result = await scrapeTikTok(username);
        break;
      case "instagram":
        result = await scrapeInstagram(username);
        break;
      case "youtube":
        result = await scrapeYouTube(username);
        break;
      case "facebook":
        result = await scrapeFacebook(username);
        break;
      default:
        return NextResponse.json(
          { error: `Unsupported platform: ${platform}` },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Scraping failed: ${message}` },
      { status: 500 }
    );
  }
}
