/**
 * Keep-Alive Script for Instagram/Facebook Sessions
 * 
 * Purpose: Simulate human activity to extend session lifetime from 3-6 months to 9-12+ months
 * 
 * Usage (TypeScript):
 *   npx ts-node keep-alive.ts instagram
 *   npx ts-node keep-alive.ts facebook
 * 
 * Usage (Compiled JavaScript):
 *   node keep-alive.js instagram
 *   node keep-alive.js facebook
 */

import fs from "fs";
import path from "path";
import os from "os";

/* eslint-disable @typescript-eslint/no-require-imports */
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
/* eslint-enable @typescript-eslint/no-require-imports */

puppeteer.use(StealthPlugin());

// ============================================================
// Configuration
// ============================================================

const ACCOUNTS_FILE = path.join(__dirname, "accounts.json");
const PROFILE_DIR = path.join(os.homedir(), ".sns-dashboard-profiles");

interface Account {
  id: string;
  platform: "instagram" | "facebook";
  username: string;
  profileDir: string;
  lastActivity: string;
}

// ============================================================
// Utilities
// ============================================================

function log(message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomScroll(): number {
  // Random scroll distance between 300-800px
  return Math.floor(Math.random() * 500) + 300;
}

async function randomInitialDelay(): Promise<void> {
  // Random delay 0-60 minutes to avoid detection
  const delaySec = Math.floor(Math.random() * 3600);
  const minutes = Math.floor(delaySec / 60);
  const seconds = delaySec % 60;
  log(`Random initial delay: ${minutes}분 ${seconds}초`);
  log(`Actual execution will start at: ${new Date(Date.now() + delaySec * 1000).toISOString()}`);
  await new Promise((resolve) => setTimeout(resolve, delaySec * 1000));
}

// ============================================================
// Account Management
// ============================================================

function loadAccounts(): Account[] {
  if (!fs.existsSync(ACCOUNTS_FILE)) {
    log(`ERROR: accounts.json not found at ${ACCOUNTS_FILE}`);
    log(`Please create accounts.json with your account configuration.`);
    process.exit(1);
  }

  try {
    const data = fs.readFileSync(ACCOUNTS_FILE, "utf-8");
    return JSON.parse(data) as Account[];
  } catch (e) {
    log(`ERROR: Failed to parse accounts.json: ${e}`);
    process.exit(1);
  }
}

function saveAccounts(accounts: Account[]): void {
  try {
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), "utf-8");
    log(`Updated accounts.json with latest activity timestamps`);
  } catch (e) {
    log(`ERROR: Failed to save accounts.json: ${e}`);
  }
}

// ============================================================
// Platform-Specific Keep-Alive Actions
// ============================================================

async function keepAliveInstagram(page: any): Promise<void> {
  log("[Instagram] Starting keep-alive activity...");

  // Wait for page load
  await randomDelay(3000, 5000);

  // Action 1: Scroll feed
  log("[Instagram] Scrolling feed...");
  await page.evaluate((distance: number) => {
    window.scrollBy(0, distance);
  }, randomScroll());
  await randomDelay(2000, 4000);

  // Action 2: Scroll again
  await page.evaluate((distance: number) => {
    window.scrollBy(0, distance);
  }, randomScroll());
  await randomDelay(2000, 4000);

  // Action 3: Visit profile
  log("[Instagram] Visiting profile page...");
  try {
    // Click profile link in navigation
    await page.evaluate(() => {
      const links = document.querySelectorAll('a[href*="/"]');
      for (const link of links) {
        const href = link.getAttribute("href") || "";
        const ariaLabel = link.getAttribute("aria-label") || "";
        // Profile link usually has aria-label containing "프로필" or "Profile"
        if (ariaLabel.includes("프로필") || ariaLabel.toLowerCase().includes("profile")) {
          (link as HTMLElement).click();
          return;
        }
      }
    });
    await randomDelay(3000, 5000);
  } catch (e) {
    log(`[Instagram] Profile click failed (non-critical): ${e}`);
  }

  // Action 4: Scroll profile
  log("[Instagram] Scrolling profile...");
  await page.evaluate((distance: number) => {
    window.scrollBy(0, distance);
  }, randomScroll());
  await randomDelay(2000, 3000);

  log("[Instagram] Keep-alive activity completed");
}

async function keepAliveFacebook(page: any): Promise<void> {
  log("[Facebook] Starting keep-alive activity...");

  // Wait for page load
  await randomDelay(3000, 5000);

  // Action 1: Scroll feed
  log("[Facebook] Scrolling feed...");
  await page.evaluate((distance: number) => {
    window.scrollBy(0, distance);
  }, randomScroll());
  await randomDelay(2000, 4000);

  // Action 2: Scroll again
  await page.evaluate((distance: number) => {
    window.scrollBy(0, distance);
  }, randomScroll());
  await randomDelay(2000, 4000);

  // Action 3: Visit profile
  log("[Facebook] Visiting profile page...");
  try {
    // Click profile link
    await page.evaluate(() => {
      const links = document.querySelectorAll('a[href*="/profile"], a[aria-label*="프로필"], a[aria-label*="Profile"]');
      if (links.length > 0) {
        (links[0] as HTMLElement).click();
      }
    });
    await randomDelay(3000, 5000);
  } catch (e) {
    log(`[Facebook] Profile click failed (non-critical): ${e}`);
  }

  // Action 4: Scroll profile
  log("[Facebook] Scrolling profile...");
  await page.evaluate((distance: number) => {
    window.scrollBy(0, distance);
  }, randomScroll());
  await randomDelay(2000, 3000);

  log("[Facebook] Keep-alive activity completed");
}

// ============================================================
// Main Keep-Alive Logic
// ============================================================

async function keepAliveAccount(account: Account): Promise<boolean> {
  log(`\n${"=".repeat(60)}`);
  log(`Processing: ${account.platform} - ${account.username} (${account.id})`);
  log(`Profile: ${account.profileDir}`);
  log(`${"=".repeat(60)}`);

  // Verify profile directory exists
  if (!fs.existsSync(account.profileDir)) {
    log(`ERROR: Profile directory not found: ${account.profileDir}`);
    log(`Please login first via /api/auth/login`);
    return false;
  }

  let browser;
  let page;

  try {
    // Launch browser with saved profile
    log(`Launching browser with profile...`);
    browser = await puppeteer.launch({
      headless: "new" as never,
      userDataDir: account.profileDir,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-infobars",
        "--window-size=1920,1080",
        "--disable-blink-features=AutomationControlled",
      ],
    });

    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Navigate to platform homepage
    const urls: Record<string, string> = {
      instagram: "https://www.instagram.com/",
      facebook: "https://www.facebook.com/",
    };

    const url = urls[account.platform];
    log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // Check if redirected to login (session expired)
    const currentUrl = page.url();
    if (currentUrl.includes("/login") || currentUrl.includes("/accounts/login")) {
      log(`ERROR: Session expired! Redirected to login page.`);
      log(`Please re-login via /api/auth/login?platform=${account.platform}&accountId=${account.id}`);
      return false;
    }

    // Perform platform-specific keep-alive actions
    if (account.platform === "instagram") {
      await keepAliveInstagram(page);
    } else if (account.platform === "facebook") {
      await keepAliveFacebook(page);
    }

    // Update last activity timestamp
    account.lastActivity = new Date().toISOString();
    log(`SUCCESS: Keep-alive completed for ${account.platform} - ${account.username}`);
    return true;

  } catch (e) {
    log(`ERROR: Failed to keep alive ${account.platform} - ${account.username}: ${e}`);
    return false;
  } finally {
    // Cleanup
    try {
      if (page) await page.close();
      if (browser) await browser.close();
    } catch (e) {
      log(`WARNING: Cleanup error: ${e}`);
    }
  }
}

// ============================================================
// Main Execution
// ============================================================

async function main(): Promise<void> {
  log(`\n${"#".repeat(60)}`);
  log(`# Keep-Alive Script Started`);
  log(`# Scheduled time: ${new Date().toISOString()}`);
  log(`${"#".repeat(60)}\n`);

  // Random initial delay (0-60 minutes)
  await randomInitialDelay();
  log(`\nActual execution time: ${new Date().toISOString()}\n`);

  // Load accounts
  let accounts = loadAccounts();
  log(`Loaded ${accounts.length} account(s) from ${ACCOUNTS_FILE}`);

  // Platform filter (optional command line argument)
  const targetPlatform = process.argv[2] as "instagram" | "facebook" | undefined;
  if (targetPlatform) {
    log(`Target platform filter: ${targetPlatform}`);
    accounts = accounts.filter((acc) => acc.platform === targetPlatform);
    log(`Processing ${accounts.length} account(s) after filtering`);
  }

  if (accounts.length === 0) {
    log(`WARNING: No accounts to process`);
    return;
  }

  // Process each account sequentially (avoid parallel sessions for same platform)
  const results: { account: Account; success: boolean }[] = [];

  for (const account of accounts) {
    const success = await keepAliveAccount(account);
    results.push({ account, success });

    // Random delay between accounts (2-5 seconds)
    await randomDelay(2000, 5000);
  }

  // Save updated accounts.json
  saveAccounts(accounts);

  // Summary
  log(`\n${"#".repeat(60)}`);
  log(`# Keep-Alive Script Completed`);
  log(`${"#".repeat(60)}`);

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  log(`\nSummary:`);
  log(`  Total: ${results.length}`);
  log(`  Successful: ${successful}`);
  log(`  Failed: ${failed}`);

  if (failed > 0) {
    log(`\nFailed accounts:`);
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        log(`  - ${r.account.platform}: ${r.account.username} (${r.account.id})`);
      });
  }

  log(`\n${"#".repeat(60)}\n`);

  // Exit with error code if any account failed
  if (failed > 0) {
    process.exit(1);
  }
}

// Run
main().catch((e) => {
  log(`FATAL ERROR: ${e}`);
  process.exit(1);
});
