/**
 * Slack notification module
 * Sends scraping results and errors to Slack channel via Incoming Webhook
 */

export interface ScrapeData {
  platform: string;
  username: string;
  displayName?: string | null;
  followers: number | null;
  lastPostDate: string | null;
  lastPostView: number | null;
  lastPostLike: number | null;
  lastPostSave: number | null;
  shadowBan?: "OK" | "BANNED" | "UNKNOWN"; // Optional, will be calculated if not provided
}

export interface BulkNotificationData {
  platform: string;
  username: string;
  displayName?: string | null;
  lastPostDate: string | null;
  lastPostView: number | null;
  shadowBan: "OK" | "BANNED" | "UNKNOWN";
}

export interface FailedAccountData {
  platform: string;
  username: string;
  displayName?: string | null;
  error: string;
}

/**
 * Format large numbers (1000 → 1K, 1000000 → 1M)
 */
function formatNumber(num: number | null): string {
  if (num === null) return "N/A";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

/**
 * Get platform emoji
 */
function getPlatformEmoji(platform: string): string {
  const emojis: Record<string, string> = {
    instagram: "📸",
    facebook: "👥",
    tiktok: "🎵",
    youtube: "▶️",
  };
  return emojis[platform.toLowerCase()] || "📊";
}

/**
 * Classify error message to simple category
 */
function classifyError(errorMessage: string): string {
  const msg = errorMessage.toLowerCase();
  
  // Network errors
  if (msg.includes("network") || msg.includes("timeout") || msg.includes("fetch")) {
    return "네트워크 에러";
  }
  
  // Authentication errors
  if (msg.includes("auth") || msg.includes("login") || msg.includes("session") || msg.includes("expired")) {
    return "인증 에러";
  }
  
  // Not found errors
  if (msg.includes("not found") || msg.includes("404")) {
    return "계정 없음";
  }
  
  // Rate limit errors
  if (msg.includes("rate limit") || msg.includes("429") || msg.includes("too many")) {
    return "요청 제한";
  }
  
  // Scraping errors
  if (msg.includes("scraping") || msg.includes("parse") || msg.includes("selector")) {
    return "스크래핑 에러";
  }
  
  // API errors
  if (msg.includes("api") || msg.includes("quota") || msg.includes("403")) {
    return "API 에러";
  }
  
  // Unknown
  return "알 수 없는 에러";
}

/**
 * Detect shadow ban based on existing criteria:
 * - Yesterday's post with < 100 views = BANNED
 * - Today's post with < 100 views = BANNED (for YouTube which shows today's date)
 */
function detectShadowBan(
  lastPostDate: string | null,
  lastPostView: number | null,
  platform?: string
): "OK" | "BANNED" | "UNKNOWN" {
  if (!lastPostDate || lastPostView === null) return "UNKNOWN";

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0]; // "YYYY-MM-DD"
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0]; // "YYYY-MM-DD"

  // YouTube: Check both today and yesterday
  if (platform?.toLowerCase() === "youtube") {
    if ((lastPostDate === todayStr || lastPostDate === yesterdayStr) && lastPostView < 100) {
      return "BANNED";
    }
  } else {
    // Other platforms: Only check yesterday
    if (lastPostDate === yesterdayStr && lastPostView < 100) {
      return "BANNED";
    }
  }

  return "OK";
}

/**
 * Send scraping success notification to Slack (Table Format)
 */
export async function sendSlackNotification(data: ScrapeData): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn("[Slack] SLACK_WEBHOOK_URL not configured. Skipping notification.");
    return;
  }

  const emoji = getPlatformEmoji(data.platform);

  // Detect shadow ban if not provided
  const shadowBan = data.shadowBan ?? detectShadowBan(data.lastPostDate, data.lastPostView, data.platform);

  // Create table text with shadow ban status
  const tableText = createTableText({ ...data, shadowBan });

  const payload = {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${emoji} ${data.platform.toUpperCase()} Update`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `\`\`\`\n${tableText}\n\`\`\``,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Updated: <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`[Slack] Failed to send notification: ${response.status} ${response.statusText}`);
    } else {
      console.log(`[Slack] Notification sent for ${data.platform}/@${data.username}`);
    }
  } catch (error) {
    console.error(`[Slack] Error sending notification:`, error);
  }
}

/**
 * Create formatted table text for Slack
 */
function createTableText(data: ScrapeData & { shadowBan: "OK" | "BANNED" | "UNKNOWN" }): string {
  const account = `@${data.displayName || data.username}`.padEnd(16);
  const followers = formatNumber(data.followers).padEnd(9);
  const lastPost = (data.lastPostDate || "N/A").padEnd(12);
  const views = formatNumber(data.lastPostView).padEnd(6);
  const shadowBan = data.shadowBan.padEnd(10);

  return `Account          | Followers | Recent Posts | Views  | Shadow Ban
-----------------|-----------|--------------|--------|------------
${account} | ${followers} | ${lastPost}  | ${views} | ${shadowBan}`;
}

/**
 * Send bulk notification to Slack (multiple accounts in one table)
 */
export async function sendBulkSlackNotification(
  data: BulkNotificationData[],
  failedAccounts?: FailedAccountData[]
): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn("[Slack] SLACK_WEBHOOK_URL not configured. Skipping bulk notification.");
    return;
  }

  if (data.length === 0) {
    console.warn("[Slack] No data to send in bulk notification.");
    return;
  }

  // Create table text for all accounts
  const tableText = createBulkTableText(data);

  // Count shadow banned accounts
  const shadowBannedCount = data.filter((d) => d.shadowBan === "BANNED").length;

  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `📊 Daily Update - ${new Date().toISOString().split("T")[0]}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `\`\`\`\n${tableText}\n\`\`\``,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Total:* ${data.length} accounts updated\n*Shadow Banned:* ${shadowBannedCount} account${shadowBannedCount !== 1 ? "s" : ""}`,
      },
    },
  ];

  // Add failed accounts table if any
  if (failedAccounts && failedAccounts.length > 0) {
    const failedTableText = createFailedTableText(failedAccounts);
    
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `⚠️ *Failed Accounts:*\n\`\`\`\n${failedTableText}\n\`\`\``,
      },
    });
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `Updated: <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
      },
    ],
  });

  const payload = { blocks };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`[Slack] Failed to send bulk notification: ${response.status} ${response.statusText}`);
    } else {
      console.log(`[Slack] Bulk notification sent for ${data.length} accounts`);
    }
  } catch (error) {
    console.error(`[Slack] Error sending bulk notification:`, error);
  }
}

/**
 * Create formatted table text for multiple accounts
 */
function createBulkTableText(data: BulkNotificationData[]): string {
  const header = `Platform  | Account               | Recent Posts | Views  | Shadow Ban
----------|-----------------------|--------------|--------|------------`;

  const rows = data.map((d) => {
    // Check if lastPostDate is today or yesterday
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    
    let lastPost: string;
    if (d.lastPostDate === todayStr || d.lastPostDate === yesterdayStr) {
      lastPost = d.lastPostDate;
    } else {
      lastPost = "-";
    }
    
    const platform = d.platform.padEnd(9);
    const account = `@${d.displayName || d.username}`.padEnd(21);
    const lastPostFormatted = lastPost.padEnd(12);
    const views = formatNumber(d.lastPostView).padEnd(6);
    const shadowBan = d.shadowBan.padEnd(10);
    return `${platform} | ${account} | ${lastPostFormatted} | ${views} | ${shadowBan}`;
  });

  return [header, ...rows].join("\n");
}

/**
 * Create formatted table text for failed accounts
 */
function createFailedTableText(data: FailedAccountData[]): string {
  const header = `Platform  | Account               | Error Type
----------|-----------------------|------------------`;

  const rows = data.map((f) => {
    const platform = f.platform.padEnd(9);
    const account = `@${f.displayName || f.username}`.padEnd(21);
    const errorType = classifyError(f.error).padEnd(18);
    return `${platform} | ${account} | ${errorType}`;
  });

  return [header, ...rows].join("\n");
}

/**
 * Send error notification to Slack (simplified format)
 */
export async function sendSlackError(params: {
  platform: string;
  username: string;
  error: string;
}): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn("[Slack] SLACK_WEBHOOK_URL not configured. Skipping error notification.");
    return;
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString("ko-KR", { 
    hour: "2-digit", 
    minute: "2-digit",
    hour12: false 
  });
  const errorType = classifyError(params.error);

  // Simplified format: 🔴 [HH:MM] Platform 실패 - @username (에러타입)
  const payload = {
    text: `🔴 [${timeStr}] ${params.platform} 실패 - @${params.username} (${errorType})`,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`[Slack] Failed to send error notification: ${response.status} ${response.statusText}`);
    } else {
      console.log(`[Slack] Error notification sent for ${params.platform}/@${params.username}`);
    }
  } catch (error) {
    console.error(`[Slack] Error sending error notification:`, error);
  }
}
