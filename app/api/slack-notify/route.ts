import { NextRequest, NextResponse } from "next/server";
import { sendBulkSlackNotification, type BulkNotificationData, type FailedAccountData } from "@/lib/slack-notifier";

/**
 * POST /api/slack-notify
 * Send bulk Slack notification with success and failed accounts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Bulk notification with success and failed accounts
    const { accounts, failedAccounts } = body as { 
      accounts: BulkNotificationData[];
      failedAccounts?: FailedAccountData[];
    };

    if (!accounts || !Array.isArray(accounts)) {
      return NextResponse.json(
        { error: "accounts array is required" },
        { status: 400 }
      );
    }

    // Send Slack notification (server-side has access to env vars)
    await sendBulkSlackNotification(accounts, failedAccounts);

    return NextResponse.json({ success: true, count: accounts.length, failed: failedAccounts?.length || 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[API] Failed to send Slack notification:", error);
    return NextResponse.json(
      { error: `Failed to send Slack notification: ${message}` },
      { status: 500 }
    );
  }
}
