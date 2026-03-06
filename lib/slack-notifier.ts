export async function sendSlackMessage(text: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("[Slack] SLACK_WEBHOOK_URL not configured.");
    return;
  }
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) console.error(`[Slack] Failed: ${res.status}`);
  } catch (error) {
    console.error(`[Slack] Error:`, error);
  }
}

export async function notifyShadowbanReady(
  deviceNumber: number,
  deviceName: string,
  platform: string,
  username: string
): Promise<void> {
  await sendSlackMessage(
    `🟢 [Shadowban 해제 가능] #${deviceNumber} ${deviceName} — ${platform} @${username} 3일 경과, 재개 가능`
  );
}

export async function notifyNewDeviceReady(
  deviceNumber: number,
  deviceName: string
): Promise<void> {
  await sendSlackMessage(
    `🆕 [신규 디바이스 준비 완료] #${deviceNumber} ${deviceName} — 7일 경과, 가동 가능`
  );
}
