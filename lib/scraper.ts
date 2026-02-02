/**
 * Platform scraper module.
 *
 * Strategy per platform:
 * - TikTok:     StalkUser (followers) + puppeteer-extra-stealth (video views/dates)
 * - Instagram:  puppeteer-extra-stealth with persistent login session
 * - YouTube:    YouTube Data API v3 (exact subscribers + latest video stats)
 * - Facebook:   puppeteer-extra-stealth with persistent login session
 */

import path from "path";
import fs from "fs";
import os from "os";
import { chromium, type Browser, type BrowserContext } from "playwright";
import { StalkUser } from "@tobyg74/tiktok-api-dl";
/* eslint-disable @typescript-eslint/no-require-imports */
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
/* eslint-enable @typescript-eslint/no-require-imports */

puppeteer.use(StealthPlugin());

// ============================================================
// Login session management (cookie-based persistence)
// ============================================================
const COOKIE_DIR = path.join(os.homedir(), ".sns-dashboard-cookies");

function getCookiePath(platform: string): string {
  return path.join(COOKIE_DIR, `${platform}.json`);
}

/** Check if a login session (cookie file) exists for a platform */
export function hasLoginSession(platform: string): boolean {
  return fs.existsSync(getCookiePath(platform));
}

// Track open login browsers so we can close them
const _loginBrowsers: Record<
  string,
  { browser: Awaited<ReturnType<typeof puppeteer.launch>>; page: unknown }
> = {};

/**
 * Open a visible browser for manual login.
 * The user logs in manually, then calls closeLoginBrowser() to save cookies.
 */
export async function openLoginBrowser(platform: string): Promise<void> {
  await closeLoginBrowser(platform);

  if (!fs.existsSync(COOKIE_DIR)) {
    fs.mkdirSync(COOKIE_DIR, { recursive: true });
  }

  const loginUrls: Record<string, string> = {
    instagram: "https://www.instagram.com/accounts/login/",
    facebook: "https://www.facebook.com/login/",
  };

  const url = loginUrls[platform];
  if (!url) throw new Error(`Unsupported platform for login: ${platform}`);

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-infobars",
      "--window-size=1280,900",
    ],
  });

  const pages = await browser.pages();
  const page = pages[0] || (await browser.newPage());
  await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 }).catch(() => {});

  _loginBrowsers[platform] = { browser, page };
  console.log(`[Auth] Opened ${platform} login browser. Please log in manually.`);
}

/**
 * Close the login browser and save cookies to disk.
 */
export async function closeLoginBrowser(platform: string): Promise<void> {
  const entry = _loginBrowsers[platform];
  if (entry) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const page = entry.page as any;
      const cookies = await page.cookies();
      fs.writeFileSync(getCookiePath(platform), JSON.stringify(cookies, null, 2));
      console.log(`[Auth] Saved ${cookies.length} cookies for ${platform}.`);
    } catch (e) {
      console.error(`[Auth] Failed to save cookies for ${platform}:`, e);
    }
    try {
      if (entry.browser.connected) await entry.browser.close();
    } catch { /* already closed */ }
    delete _loginBrowsers[platform];
    console.log(`[Auth] Closed ${platform} login browser.`);
  }
}

/**
 * Launch a headless stealth browser and inject saved cookies.
 * Returns { browser, page } — caller must close page when done.
 */
async function openLoggedInPage(platform: string, url: string) {
  const cookiePath = getCookiePath(platform);
  if (!fs.existsSync(cookiePath)) {
    throw new Error(`No login session for ${platform}. Please login first via /api/auth/login`);
  }

  const browser = await getStealthBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Load and inject cookies
  const cookies = JSON.parse(fs.readFileSync(cookiePath, "utf-8"));
  await page.setCookie(...cookies);

  // Navigate
  await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 3000));

  return page;
}

export async function closeLoggedInBrowser(_platform: string): Promise<void> {
  // No-op: we now reuse the shared stealth browser singleton
}

export interface ScrapeResult {
  platform: string;
  username: string;
  followers: number | null;
  lastPostDate: string | null;
  lastPostView: number | null;
  lastPostLike: number | null;
  lastPostSave: number | null;
}

// ============================================================
// Shared browser (lazy singleton)
// ============================================================
let _browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!_browser || !_browser.isConnected()) {
    const isDebug = process.env.SCRAPER_DEBUG === "true";
    _browser = await chromium.launch({
      headless: !isDebug,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-dev-shm-usage",
        "--no-first-run",
        "--no-zygote",
        "--disable-background-networking",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-breakpad",
        "--disable-component-extensions-with-background-pages",
        "--disable-extensions",
        "--disable-features=TranslateUI",
        "--disable-ipc-flooding-protection",
        "--disable-renderer-backgrounding",
        "--enable-features=NetworkService,NetworkServiceInProcess",
        "--force-color-profile=srgb",
        "--hide-scrollbars",
        "--metrics-recording-only",
        "--mute-audio",
      ],
    });
  }
  return _browser;
}

// Randomized User-Agents (recent Chrome versions)
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
];

// Randomized viewports (common desktop resolutions)
const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1680, height: 1050 },
  { width: 2560, height: 1440 },
  { width: 1280, height: 720 },
];

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function newContext(): Promise<BrowserContext> {
  const browser = await getBrowser();
  const ua = randomPick(USER_AGENTS);
  const vp = randomPick(VIEWPORTS);

  const context = await browser.newContext({
    userAgent: ua,
    locale: "ko-KR",
    viewport: vp,
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
    javaScriptEnabled: true,
    permissions: [],
    extraHTTPHeaders: {
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "cross-site",
      "Sec-Fetch-User": "?1",
      "Cache-Control": "max-age=0",
      "Referer": "https://www.google.com/",
    },
  });

  // Stealth scripts to avoid bot detection
  await context.addInitScript(() => {
    // 1. Override navigator.webdriver
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    // 2. Mock plugins (more realistic)
    Object.defineProperty(navigator, 'plugins', {
      get: () => ({
        length: 3,
        0: { name: 'Chrome PDF Plugin' },
        1: { name: 'Chrome PDF Viewer' },
        2: { name: 'Native Client' },
      }),
    });

    // 3. Mock languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['ko-KR', 'ko', 'en-US', 'en'],
    });

    // 4. Chrome runtime
    (window as any).chrome = {
      runtime: {},
      loadTimes: function() {},
      csi: function() {},
      app: {},
    };

    // 5. Permissions
    const originalQuery = (window.navigator.permissions as any).query;
    (window.navigator.permissions as any).query = (parameters: any) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: 'denied' }) :
        originalQuery(parameters)
    );

    // 6. Override canvas fingerprinting
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type?: string) {
      const context = this.getContext('2d');
      if (context) {
        const imageData = context.getImageData(0, 0, this.width, this.height);
        for (let i = 0; i < imageData.data.length; i += 4) {
          imageData.data[i] += Math.random() < 0.1 ? 1 : 0;
        }
        context.putImageData(imageData, 0, 0);
      }
      return originalToDataURL.apply(this, [type]);
    };

    // 7. WebGL vendor and renderer
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      if (parameter === 37445) return 'Intel Inc.';
      if (parameter === 37446) return 'Intel Iris OpenGL Engine';
      return getParameter.call(this, parameter);
    };

    // 8. Mock hardwareConcurrency
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => 8,
    });

    // 9. Mock deviceMemory
    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => 8,
    });

    // 10. Mock platform
    Object.defineProperty(navigator, 'platform', {
      get: () => 'Win32',
    });

    // 11. Mock vendor
    Object.defineProperty(navigator, 'vendor', {
      get: () => 'Google Inc.',
    });

    // 12. Mock connection
    Object.defineProperty(navigator, 'connection', {
      get: () => ({
        effectiveType: '4g',
        rtt: 100,
        downlink: 10,
        saveData: false,
      }),
    });

    // 13. Hide automation indicators
    delete (navigator as any).__proto__.webdriver;

    // 14. Mock battery API
    Object.defineProperty(navigator, 'getBattery', {
      value: () => Promise.resolve({
        charging: true,
        chargingTime: 0,
        dischargingTime: Infinity,
        level: 1,
      }),
    });
  });

  return context;
}

// ============================================================
// Helpers
// ============================================================
function parseNum(s: string | null | undefined): number | null {
  if (!s) return null;
  const t = s.replace(/,/g, "").trim();
  const manMatch = t.match(/^([\d.]+)\s*만$/);
  if (manMatch) return Math.round(parseFloat(manMatch[1]) * 10000);
  const cheonMatch = t.match(/^([\d.]+)\s*천$/);
  if (cheonMatch) return Math.round(parseFloat(cheonMatch[1]) * 1000);
  const eokMatch = t.match(/^([\d.]+)\s*억$/);
  if (eokMatch) return Math.round(parseFloat(eokMatch[1]) * 100000000);
  const kMatch = t.match(/^([\d.]+)\s*[Kk]$/);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);
  const mMatch = t.match(/^([\d.]+)\s*[Mm]$/);
  if (mMatch) return Math.round(parseFloat(mMatch[1]) * 1000000);
  const n = parseFloat(t);
  return isNaN(n) ? null : Math.round(n);
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

/** Parse relative Korean date strings like "1일 전", "3시간 전", "5년 전" */
function parseRelativeDate(text: string): string | null {
  const now = new Date();
  const yearMatch = text.match(/(\d+)\s*년\s*전/);
  const dayMatch = text.match(/(\d+)\s*일\s*전/);
  const hourMatch = text.match(/(\d+)\s*시간?\s*전?/);
  const minMatch = text.match(/(\d+)\s*분\s*전/);
  const weekMatch = text.match(/(\d+)\s*주\s*전/);
  const monthMatch = text.match(/(\d+)\s*개월\s*전/);

  if (yearMatch) {
    now.setFullYear(now.getFullYear() - parseInt(yearMatch[1]));
  } else if (dayMatch) {
    now.setDate(now.getDate() - parseInt(dayMatch[1]));
  } else if (hourMatch && text.includes("시간")) {
    now.setHours(now.getHours() - parseInt(hourMatch[1]));
  } else if (minMatch) {
    now.setMinutes(now.getMinutes() - parseInt(minMatch[1]));
  } else if (weekMatch) {
    now.setDate(now.getDate() - parseInt(weekMatch[1]) * 7);
  } else if (monthMatch) {
    now.setMonth(now.getMonth() - parseInt(monthMatch[1]));
  } else if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(text.trim())) {
    return text.trim();
  } else {
    return null;
  }
  return now.toISOString().split("T")[0];
}

const emptyResult = (platform: string, username: string): ScrapeResult => ({
  platform,
  username,
  followers: null,
  lastPostDate: null,
  lastPostView: null,
  lastPostLike: null,
  lastPostSave: null,
});

// ============================================================
// TikTok — Hybrid: StalkUser (followers) + puppeteer-extra-stealth (videos)
// ============================================================

// Shared stealth browser (lazy singleton)
let _stealthBrowser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

async function getStealthBrowser() {
  if (!_stealthBrowser || !_stealthBrowser.connected) {
    _stealthBrowser = await puppeteer.launch({
      headless: "new" as never,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-infobars",
        "--window-size=1920,1080",
      ],
    });
  }
  return _stealthBrowser;
}

// Concurrency control: max 2 simultaneous TikTok stealth tabs
const TIKTOK_CONCURRENCY = 2;
let _tiktokActiveSlots = 0;
const _tiktokQueue: Array<() => void> = [];

async function acquireTikTokSlot(): Promise<void> {
  if (_tiktokActiveSlots < TIKTOK_CONCURRENCY) {
    _tiktokActiveSlots++;
    return;
  }
  return new Promise<void>((resolve) => {
    _tiktokQueue.push(() => {
      _tiktokActiveSlots++;
      resolve();
    });
  });
}

function releaseTikTokSlot(): void {
  _tiktokActiveSlots--;
  const next = _tiktokQueue.shift();
  if (next) next();
}

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((r) => setTimeout(r, ms));
}

// Concurrency control for Instagram/Facebook: 1 tab at a time (logged-in session)
const _platformQueues: Record<string, { active: number; queue: Array<() => void> }> = {};

function getPlatformQueue(platform: string) {
  if (!_platformQueues[platform]) {
    _platformQueues[platform] = { active: 0, queue: [] };
  }
  return _platformQueues[platform];
}

async function acquirePlatformSlot(platform: string): Promise<void> {
  const q = getPlatformQueue(platform);
  if (q.active < 1) {
    q.active++;
    return;
  }
  return new Promise<void>((resolve) => {
    q.queue.push(() => {
      q.active++;
      resolve();
    });
  });
}

function releasePlatformSlot(platform: string): void {
  const q = getPlatformQueue(platform);
  q.active--;
  const next = q.queue.shift();
  if (next) next();
}

interface TikTokVideoData {
  playCount: number;
  diggCount: number;
  commentCount: number;
  shareCount: number;
  createTime: number;
}

/**
 * Single attempt to fetch video stats from TikTok via stealth browser.
 */
async function fetchTikTokVideosOnce(username: string): Promise<TikTokVideoData | null> {
  const browser = await getStealthBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  let latestVideo: TikTokVideoData | null = null;

  try {
    const videoDataPromise = new Promise<TikTokVideoData | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), 20000);

      page.on("response", async (response: { url(): string; text(): Promise<string> }) => {
        if (!response.url().includes("/api/post/item_list")) return;
        try {
          const text = await response.text();
          if (text.length < 10) return;
          const json = JSON.parse(text);
          if (json.itemList && json.itemList.length > 0) {
            let newest = json.itemList[0];
            for (const item of json.itemList) {
              if (item.createTime > newest.createTime) newest = item;
            }
            clearTimeout(timeout);
            resolve({
              playCount: newest.stats?.playCount ?? 0,
              diggCount: newest.stats?.diggCount ?? 0,
              commentCount: newest.stats?.commentCount ?? 0,
              shareCount: newest.stats?.shareCount ?? 0,
              createTime: newest.createTime ?? 0,
            });
          }
        } catch {
          // ignore parse errors
        }
      });
    });

    await page.goto(`https://www.tiktok.com/@${username}`, {
      waitUntil: "networkidle2",
      timeout: 25000,
    }).catch(() => {});

    latestVideo = await videoDataPromise;
  } catch (e) {
    console.error(`[TikTok] Stealth browser error for @${username}:`, e);
  } finally {
    await page.close();
  }

  return latestVideo;
}

/**
 * Fetch video stats with concurrency control, delay, and 1 retry.
 */
async function fetchTikTokVideos(username: string): Promise<TikTokVideoData | null> {
  await acquireTikTokSlot();
  try {
    let result = await fetchTikTokVideosOnce(username);

    // Retry once on failure
    if (!result) {
      console.log(`[TikTok] @${username} — retrying video fetch...`);
      await randomDelay(2000, 4000);
      result = await fetchTikTokVideosOnce(username);
    }

    // Delay before releasing slot to space out requests
    await randomDelay(2000, 4000);
    return result;
  } finally {
    releaseTikTokSlot();
  }
}

/**
 * TikTok scraper — hybrid approach:
 * 1. StalkUser API for followers (fast, reliable)
 * 2. puppeteer-extra-stealth for video views/dates (bypasses TikTok bot detection)
 */
export async function scrapeTikTok(username: string): Promise<ScrapeResult> {
  const result = emptyResult("tiktok", username);

  // Step 1: Followers via StalkUser (fast HTTP, no browser)
  try {
    console.log(`[TikTok] Scraping @${username} — Step 1: StalkUser...`);
    const res = await StalkUser(username);
    if (res.status === "success" && res.result) {
      const r = res.result as { stats?: { followerCount?: number } };
      if (r.stats?.followerCount != null) {
        result.followers = r.stats.followerCount;
      }
    }
  } catch (e) {
    console.warn(`[TikTok] StalkUser failed for @${username}:`, e);
  }

  // Step 2: Video data via stealth browser (concurrency-limited)
  try {
    console.log(`[TikTok] Scraping @${username} — Step 2: video data...`);
    const video = await fetchTikTokVideos(username);
    if (video) {
      result.lastPostView = video.playCount;
      result.lastPostLike = video.diggCount;
      result.lastPostDate = new Date(video.createTime * 1000).toISOString().split("T")[0];
    }
  } catch (e) {
    console.warn(`[TikTok] Video fetch failed for @${username}:`, e);
  }

  const fields = [result.followers, result.lastPostDate, result.lastPostView, result.lastPostLike, result.lastPostSave];
  const score = fields.filter((f) => f !== null).length;
  console.log(`[TikTok] @${username}: followers=${result.followers} views=${result.lastPostView} date=${result.lastPostDate} (${score}/5 fields)`);

  return result;
}

/** @deprecated Use scrapeTikTok directly */
export const scrapeTikTokWithRetry = scrapeTikTok;

// ============================================================
// Instagram — puppeteer-extra-stealth with persistent login session
// Requires: user logs in once via /api/auth/login?platform=instagram
// ============================================================
export async function scrapeInstagram(username: string): Promise<ScrapeResult> {
  const result = emptyResult("instagram", username);

  // Fallback: if no login session, use old og:description method for followers only
  if (!hasLoginSession("instagram")) {
    console.warn(`[Instagram] No login session — falling back to og:description for @${username}`);
    const context = await newContext();
    try {
      const page = await context.newPage();
      await page.goto(`https://www.instagram.com/${username}/`, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      await page.waitForTimeout(2000);
      const desc = await page.evaluate(() => {
        const m = document.querySelector('meta[property="og:description"]');
        return m?.getAttribute("content") ?? null;
      });
      if (desc) {
        const kr = desc.match(/팔로워\s+([\d,만.]+)\s*명/);
        if (kr) result.followers = parseNum(kr[1]);
        if (result.followers === null) {
          const en = desc.match(/([\d,KkMm.]+)\s+[Ff]ollowers/);
          if (en) result.followers = parseNum(en[1]);
        }
      }
    } catch (e) {
      console.error(`[Instagram] Fallback error for @${username}:`, e);
    } finally {
      await context.close();
    }
    return result;
  }

  await acquirePlatformSlot("instagram");
  let page;
  try {
    // Step 1: Profile page → followers
    console.log(`[Instagram] Scraping @${username} (logged in)...`);
    page = await openLoggedInPage("instagram", `https://www.instagram.com/${username}/`);

    // Check if session expired (redirected to login)
    if (page.url().includes("/accounts/login")) {
      console.error(`[Instagram] Session expired! Please re-login via /api/auth/login`);
      await page.close();
      return result;
    }

    // Followers from profile header
    const followers = await page.evaluate(() => {
      // Strategy 1: meta og:description
      const meta = document.querySelector('meta[property="og:description"]');
      const desc = meta?.getAttribute("content") ?? "";
      const krMatch = desc.match(/팔로워\s+([\d,만.]+)\s*명/);
      if (krMatch) return krMatch[1];
      const enMatch = desc.match(/([\d,KkMm.]+)\s+[Ff]ollowers/);
      if (enMatch) return enMatch[1];

      // Strategy 2: header section links with "followers"
      const links = document.querySelectorAll("a[href*='followers'], a[href*='/followers']");
      for (const link of links) {
        const text = link.textContent?.trim() || "";
        const numMatch = text.match(/([\d,만천.KkMm]+)/);
        if (numMatch) return numMatch[1];
      }

      // Strategy 3: spans with title attribute containing follower count
      const spans = document.querySelectorAll("span[title]");
      for (const span of spans) {
        const parent = span.closest("a");
        if (parent?.href?.includes("follower")) {
          return span.getAttribute("title") || span.textContent?.trim() || null;
        }
      }

      return null;
    });
    if (followers) result.followers = parseNum(followers);

    // Step 2: Reels tab → first reel views + href
    await page.goto(`https://www.instagram.com/${username}/reels/`, {
      waitUntil: "networkidle2",
      timeout: 25000,
    }).catch(() => {});
    await new Promise((r) => setTimeout(r, 3000));

    const reelInfo = await page.evaluate(() => {
      const reelLinks = document.querySelectorAll('a[href*="/reel/"]');
      if (reelLinks.length === 0) return null;
      const firstReel = reelLinks[0];
      const href = firstReel.getAttribute("href");

      // Thumbnail spans contain: [likes, likes, comments, comments, views, views]
      // Extract unique numbers in order to separate likes vs views
      const spans = firstReel.querySelectorAll("span");
      const uniqueNums: string[] = [];
      let prevText = "";
      for (const span of spans) {
        const text = span.textContent?.trim() || "";
        if (/^[\d,.만천KkMm]+$/.test(text) && text.length < 15 && /\d/.test(text)) {
          // Skip duplicate (Instagram renders each number twice)
          if (text !== prevText) {
            uniqueNums.push(text);
          }
          prevText = text;
        }
      }

      // Pattern: [likes, comments, views] — views is the last number
      const thumbLikes = uniqueNums.length >= 1 ? uniqueNums[0] : null;
      const thumbViews = uniqueNums.length >= 3 ? uniqueNums[2] : null;

      return { href, thumbLikes, thumbViews };
    });

    if (reelInfo?.thumbViews) {
      result.lastPostView = parseNum(reelInfo.thumbViews);
    }

    // Step 3: Individual reel page → likes + date (views already from thumbnail)
    if (reelInfo?.href) {
      const reelUrl = reelInfo.href.startsWith("http")
        ? reelInfo.href
        : `https://www.instagram.com${reelInfo.href}`;

      await page.goto(reelUrl, { waitUntil: "networkidle2", timeout: 25000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 3000));

      const reelStats = await page.evaluate(() => {
        let likes: string | null = null;
        let dateStr: string | null = null;

        // Likes: "좋아요 N개" pattern (Korean)
        const allElements = document.querySelectorAll("button, span, a, div, section");
        for (const el of allElements) {
          const text = el.textContent?.trim() || "";
          if (text.includes("좋아요") && /\d/.test(text) && text.length < 30) {
            const m = text.match(/([\d,.만천억KkMm]+)/);
            if (m) { likes = m[1]; break; }
          }
        }
        // Fallback likes: "Like" followed by a number (English UI)
        // e.g. section text = "Like5CommentShareSave" → extract the number after "Like"
        if (!likes) {
          for (const el of allElements) {
            const text = el.textContent?.trim() || "";
            if (text.length < 40) {
              const m = text.match(/^Like(\d[\d,.KkMm]*)(?:Comment|$)/);
              if (m) { likes = m[1]; break; }
            }
          }
        }
        // Fallback likes: standalone number in a span near like/heart section
        if (!likes) {
          const spans = document.querySelectorAll("section span");
          for (const span of spans) {
            const text = span.textContent?.trim() || "";
            if (/^[\d,.만천KkMm]+$/.test(text) && text.length > 0 && text.length < 15) {
              likes = text;
              break;
            }
          }
        }

        // Date: <time> element with datetime attribute
        const timeEls = document.querySelectorAll("time[datetime]");
        for (const t of timeEls) {
          const dt = t.getAttribute("datetime");
          if (dt) {
            dateStr = dt.split("T")[0];
            break;
          }
        }
        // Fallback: <time> with text
        if (!dateStr) {
          const timeEls2 = document.querySelectorAll("time");
          for (const t of timeEls2) {
            const text = t.textContent?.trim() || "";
            if (text.length > 1 && /\d/.test(text)) {
              dateStr = text;
              break;
            }
          }
        }

        return { likes, dateStr };
      });

      if (reelStats.likes) result.lastPostLike = parseNum(reelStats.likes);
      // Fallback: use thumbnail likes if reel detail didn't find them
      if (!result.lastPostLike && reelInfo.thumbLikes) {
        result.lastPostLike = parseNum(reelInfo.thumbLikes);
      }
      if (reelStats.dateStr) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(reelStats.dateStr)) {
          result.lastPostDate = reelStats.dateStr;
        } else {
          result.lastPostDate = parseRelativeDate(reelStats.dateStr);
        }
      }
    }
  } catch (e) {
    console.error(`[Instagram] Error scraping @${username}:`, e);
  } finally {
    if (page) await page.close().catch(() => {});
    await randomDelay(2000, 4000);
    releasePlatformSlot("instagram");
  }

  const fields = [result.followers, result.lastPostDate, result.lastPostView, result.lastPostLike, result.lastPostSave];
  const score = fields.filter((f) => f !== null).length;
  console.log(`[Instagram] @${username}: followers=${result.followers} views=${result.lastPostView} likes=${result.lastPostLike} date=${result.lastPostDate} (${score}/5 fields)`);

  return result;
}

// ============================================================
// YouTube — YouTube Data API v3 (exact subscribers + latest video stats)
// ============================================================
export async function scrapeYouTube(username: string): Promise<ScrapeResult> {
  const result = emptyResult("youtube", username);
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    console.error("[YouTube] YOUTUBE_API_KEY not set in .env");
    return result;
  }

  try {
    console.log(`[YouTube] Fetching data for @${username} via YouTube Data API...`);

    // Step 1: Get channel ID + subscriber count from handle
    const channelRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=${username}&key=${apiKey}`
    );
    if (!channelRes.ok) {
      console.error(`[YouTube] Channel API error: ${channelRes.status} ${channelRes.statusText}`);
      return result;
    }

    const channelData = await channelRes.json() as {
      items?: Array<{
        id: string;
        statistics?: {
          subscriberCount?: string;
          hiddenSubscriberCount?: boolean;
        };
      }>;
    };

    if (!channelData.items || channelData.items.length === 0) {
      console.warn(`[YouTube] Channel not found for @${username}`);
      return result;
    }

    const channel = channelData.items[0];
    const channelId = channel.id;

    // Subscribers
    if (channel.statistics?.subscriberCount && !channel.statistics.hiddenSubscriberCount) {
      result.followers = toNum(channel.statistics.subscriberCount);
    }

    // Step 2: Get latest video (Shorts are also videos)
    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=id&channelId=${channelId}&order=date&maxResults=1&type=video&key=${apiKey}`
    );
    if (!searchRes.ok) {
      console.error(`[YouTube] Search API error: ${searchRes.status} ${searchRes.statusText}`);
      return result;
    }

    const searchData = await searchRes.json() as {
      items?: Array<{ id: { videoId?: string } }>;
    };

    if (!searchData.items || searchData.items.length === 0 || !searchData.items[0].id.videoId) {
      console.warn(`[YouTube] No videos found for @${username}`);
      return result;
    }

    const videoId = searchData.items[0].id.videoId;

    // Step 3: Get video details (views, likes, date)
    const videoRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoId}&key=${apiKey}`
    );
    if (!videoRes.ok) {
      console.error(`[YouTube] Video API error: ${videoRes.status} ${videoRes.statusText}`);
      return result;
    }

    const videoData = await videoRes.json() as {
      items?: Array<{
        snippet?: { publishedAt?: string };
        statistics?: {
          viewCount?: string;
          likeCount?: string;
        };
      }>;
    };

    if (videoData.items && videoData.items.length > 0) {
      const video = videoData.items[0];
      if (video.snippet?.publishedAt) {
        result.lastPostDate = video.snippet.publishedAt.split("T")[0];
      }
      if (video.statistics?.viewCount) {
        result.lastPostView = toNum(video.statistics.viewCount);
      }
      if (video.statistics?.likeCount) {
        result.lastPostLike = toNum(video.statistics.likeCount);
      }
    }

    const fields = [result.followers, result.lastPostDate, result.lastPostView, result.lastPostLike, result.lastPostSave];
    const score = fields.filter((f) => f !== null).length;
    console.log(`[YouTube] Got ${score}/5 fields for @${username}`);

    return result;
  } catch (e) {
    console.error(`[YouTube] Error scraping @${username}:`, e);
    return result;
  }
}

// ============================================================
// Facebook — puppeteer-extra-stealth with persistent login session
// Falls back to Playwright (no login) if no session exists
// ============================================================
export async function scrapeFacebook(username: string): Promise<ScrapeResult> {
  const result = emptyResult("facebook", username);

  const isIdBased = /^\d+$/.test(username);
  const reelsUrl = isIdBased
    ? `https://www.facebook.com/profile.php?id=${username}&sk=reels`
    : `https://www.facebook.com/${username}/reels/`;

  // Fallback: if no login session, use Playwright (limited data)
  if (!hasLoginSession("facebook")) {
    console.warn(`[Facebook] No login session — using Playwright fallback for ${username}`);
    const context = await newContext();
    try {
      const page = await context.newPage();
      await page.goto(reelsUrl, { waitUntil: "networkidle", timeout: 25000 });
      await page.waitForTimeout(3000);

      // Close login dialog
      try {
        const closeBtn = page.locator('div[role="dialog"] button[aria-label="닫기"]');
        if (await closeBtn.isVisible({ timeout: 2000 })) {
          await closeBtn.click();
          await page.waitForTimeout(500);
        }
      } catch { /* */ }

      // Followers
      const followerData = await page.evaluate(() => {
        const links = document.querySelectorAll("a, span");
        for (const el of links) {
          const text = el.textContent?.trim() || "";
          if (
            (text.includes("팔로워") || text.toLowerCase().includes("follower")) &&
            /\d/.test(text) && text.length < 60
          ) {
            const numMatch = text.match(/([\d,.만KkMm]+)/);
            if (numMatch) return numMatch[1];
          }
        }
        return null;
      });
      if (followerData) result.followers = parseNum(followerData);
    } catch (e) {
      console.error(`[Facebook] Fallback error for ${username}:`, e);
    } finally {
      await context.close();
    }
    return result;
  }

  // Logged-in stealth browser
  await acquirePlatformSlot("facebook");
  let page;
  try {
    // Step 1: Visit MAIN profile page first → followers
    const profileUrl = isIdBased
      ? `https://www.facebook.com/profile.php?id=${username}`
      : `https://www.facebook.com/${username}/`;

    console.log(`[Facebook] Scraping ${username} (logged in) — Step 1: profile page...`);
    page = await openLoggedInPage("facebook", profileUrl);

    // Check if redirected to login
    if (page.url().includes("/login")) {
      console.error(`[Facebook] Session expired! Please re-login via /api/auth/login`);
      await page.close();
      return result;
    }

    // Followers from profile page
    const followerData = await page.evaluate(() => {
      // Strategy 1: "N명이 팔로우합니다" / "N명이 팔로우" (Facebook Page format)
      const allEls = document.querySelectorAll("a, span, div");
      for (const el of allEls) {
        const text = el.textContent?.trim() || "";
        // Facebook Pages: "1,320명이 팔로우합니다" or "1.3만명이 팔로우합니다"
        const followMatch = text.match(/([\d,.만천억KkMm]+)\s*명이\s*팔로우/);
        if (followMatch) return followMatch[1];
        // "팔로워 1,320명" or "팔로워 1.3만명"
        const followerMatch = text.match(/팔로워\s*([\d,.만천억KkMm]+)\s*명?/);
        if (followerMatch) return followerMatch[1];
      }

      // Strategy 2: links/spans containing "팔로워" or "follower" keyword
      for (const el of allEls) {
        const text = el.textContent?.trim() || "";
        if (
          (text.includes("팔로워") || text.includes("팔로우") || text.toLowerCase().includes("follower")) &&
          /\d/.test(text) && text.length < 60
        ) {
          const strongEl = el.querySelector("strong");
          if (strongEl) return strongEl.textContent?.trim() ?? null;
          const numMatch = text.match(/([\d,.만천억KkMm]+)/);
          if (numMatch) return numMatch[1];
        }
      }

      // Strategy 3: aria-label on follower links
      const ariaEls = document.querySelectorAll("[aria-label]");
      for (const el of ariaEls) {
        const label = el.getAttribute("aria-label") || "";
        if (
          (label.includes("팔로워") || label.includes("팔로우") || label.toLowerCase().includes("follower")) &&
          /\d/.test(label)
        ) {
          const m = label.match(/([\d,.만천억KkMm]+)/);
          if (m) return m[1];
        }
      }

      // Strategy 4: href containing "/followers" with a number nearby
      const followerLinks = document.querySelectorAll('a[href*="follower"], a[href*="friends"]');
      for (const link of followerLinks) {
        const text = link.textContent?.trim() || "";
        const numMatch = text.match(/([\d,.만천억KkMm]+)/);
        if (numMatch) return numMatch[1];
      }

      // Strategy 5: "좋아요 N개" / "N명이 좋아합니다" (Page likes as fallback for followers)
      for (const el of allEls) {
        const text = el.textContent?.trim() || "";
        const likeMatch = text.match(/([\d,.만천억KkMm]+)\s*명이\s*좋아합니다/);
        if (likeMatch) return likeMatch[1];
      }

      return null;
    });
    if (followerData) result.followers = parseNum(followerData);

    // Debug: if followers not found, log page text snippets containing numbers
    if (!followerData) {
      const debugText = await page.evaluate(() => {
        const snippets: string[] = [];
        const els = document.querySelectorAll("a, span");
        for (const el of els) {
          const text = el.textContent?.trim() || "";
          if (/\d/.test(text) && text.length > 2 && text.length < 80 &&
              (text.includes("팔로") || text.includes("좋아") || text.toLowerCase().includes("follow") || text.toLowerCase().includes("like"))) {
            snippets.push(text.substring(0, 70));
          }
          if (snippets.length >= 5) break;
        }
        return snippets;
      });
      console.log(`[Facebook] ${username} — follower debug snippets:`, debugText);
    }
    console.log(`[Facebook] ${username} — followers: ${result.followers}`);

    // Step 2: Navigate to videos page → first video's views + date
    // Facebook Videos tab shows "5년 전  · 조회 117회" per video card
    const videosUrl = isIdBased
      ? `https://www.facebook.com/profile.php?id=${username}&sk=videos`
      : `https://www.facebook.com/${username}/videos/`;

    console.log(`[Facebook] Scraping ${username} — Step 2: videos page...`);
    await page.goto(videosUrl, { waitUntil: "networkidle2", timeout: 25000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 4000));

    // Scroll to trigger lazy-loaded video cards
    await page.evaluate(() => window.scrollBy(0, 800));
    await new Promise((r) => setTimeout(r, 2000));

    const videoInfo = await page.evaluate(() => {
      let views: string | null = null;
      let dateStr: string | null = null;

      const allEls = document.querySelectorAll("span, div, abbr");

      // Strategy 1: "조회 N회" pattern (Korean)
      for (const el of allEls) {
        if (el.children.length > 3) continue;
        const text = el.textContent?.trim() || "";
        const m = text.match(/조회\s*([\d,.만천억KkMm]+)\s*회/);
        if (m) { views = m[1]; break; }
      }
      // Strategy 2: "N views" pattern (English)
      if (!views) {
        for (const el of allEls) {
          if (el.children.length > 3) continue;
          const text = el.textContent?.trim() || "";
          const m = text.match(/([\d,.KkMm]+)\s*views/i);
          if (m) { views = m[1]; break; }
        }
      }

      // Date: relative Korean "N년 전", "N일 전", "N시간 전", etc.
      for (const el of allEls) {
        if (el.children.length > 2) continue;
        const text = el.textContent?.trim() || "";
        if (/^\d+\s*(년|개월|주|일|시간|분)\s*전$/.test(text)) {
          dateStr = text; break;
        }
      }
      // Date fallback: <abbr> with relative text or aria-label
      if (!dateStr) {
        const abbrs = document.querySelectorAll("abbr");
        for (const abbr of abbrs) {
          const text = abbr.textContent?.trim() || "";
          if (/^\d+\s*(년|개월|주|일|시간|분)\s*전?$/.test(text)) {
            dateStr = text.endsWith("전") ? text : text + " 전";
            break;
          }
          const aria = abbr.getAttribute("aria-label") || "";
          if (/^\d+\s*(년|개월|주|일|시간|분)\s*전$/.test(aria)) {
            dateStr = aria; break;
          }
        }
      }
      // Date fallback: absolute Korean date "2025년 1월 15일"
      if (!dateStr) {
        for (const el of allEls) {
          const text = el.textContent?.trim() || "";
          if (/\d{4}년\s*\d{1,2}월\s*\d{1,2}일/.test(text) && text.length < 30) {
            const m = text.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
            if (m) {
              dateStr = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
              break;
            }
          }
        }
      }

      return { views, dateStr };
    });

    if (videoInfo.views) result.lastPostView = parseNum(videoInfo.views);
    if (videoInfo.dateStr) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(videoInfo.dateStr)) {
        result.lastPostDate = videoInfo.dateStr;
      } else {
        result.lastPostDate = parseRelativeDate(videoInfo.dateStr);
      }
    }
    console.log(`[Facebook] ${username} — views: ${result.lastPostView}, date: ${result.lastPostDate}`);
  } catch (e) {
    console.error(`[Facebook] Error scraping ${username}:`, e);
  } finally {
    if (page) await page.close().catch(() => {});
    await randomDelay(2000, 4000);
    releasePlatformSlot("facebook");
  }

  const fields = [result.followers, result.lastPostDate, result.lastPostView, result.lastPostLike, result.lastPostSave];
  const score = fields.filter((f) => f !== null).length;
  console.log(`[Facebook] ${username}: followers=${result.followers} views=${result.lastPostView} likes=${result.lastPostLike} date=${result.lastPostDate} (${score}/5 fields)`);

  return result;
}
