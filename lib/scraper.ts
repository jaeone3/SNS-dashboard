/**
 * Platform scraper module — ALL platforms use Playwright headless browser.
 *
 * Strategy per platform:
 * - TikTok:     Profile page → followers + first non-pinned video views
 *               Video detail page → SSR JSON for date/like/save (fallback: DOM)
 * - Instagram:  Reels page → followers (og:description / DOM) + first reel views
 *               Reel detail page → like count + date
 * - YouTube:    Channel page → subscribers + latest Shorts views
 * - Facebook:   Reels tab → followers + first reel views
 */

import { chromium, type Browser, type BrowserContext } from "playwright";

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
    // Set headless to false for debugging (can see what's happening)
    // Set to true for production
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

async function newContext(): Promise<BrowserContext> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "ko-KR",
    viewport: { width: 1920, height: 1080 },
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
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Cache-Control": "max-age=0",
    },
  });

  // Enhanced stealth scripts to avoid bot detection
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

// Random delay helper
function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
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

/** Parse relative Korean date strings like "1일 전", "3시간 전", "10시간 전" */
function parseRelativeDate(text: string): string | null {
  const now = new Date();
  const dayMatch = text.match(/(\d+)\s*일\s*전/);
  const hourMatch = text.match(/(\d+)\s*시간?\s*전?/);
  const minMatch = text.match(/(\d+)\s*분\s*전/);
  const weekMatch = text.match(/(\d+)\s*주\s*전/);
  const monthMatch = text.match(/(\d+)\s*개월\s*전/);

  if (dayMatch) {
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
// TikTok — Playwright (profile SSR + API intercept for video list)
// ============================================================
export async function scrapeTikTok(username: string): Promise<ScrapeResult> {
  const result = emptyResult("tiktok", username);
  const context = await newContext();

  try {
    const page = await context.newPage();

    // Set up API intercept to capture video list data
    interface TikTokVideoItem {
      id: string;
      createTime: number;
      isPinnedItem?: boolean;
      stats?: { playCount?: number; diggCount?: number; collectCount?: number };
    }
    let interceptedVideos: TikTokVideoItem[] = [];

    page.on("response", async (response) => {
      const url = response.url();
      if (url.includes("/api/post/item_list") && interceptedVideos.length === 0) {
        try {
          const json = await response.json();
          if (json?.itemList?.length > 0) {
            interceptedVideos = json.itemList;
          }
        } catch { /* body may be empty due to bot detection */ }
      }
    });

    // --- Step 1: Profile page → followers (SSR) + wait for API video list ---
    await page.goto(`https://www.tiktok.com/@${username}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Shorter delay to speed up (2-3 seconds)
    await randomDelay(2000, 3000);

    // Wait for network to settle (reduced timeout)
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

    // Mimic human mouse movements (faster)
    await page.mouse.move(100, 100);
    await randomDelay(200, 400);
    await page.mouse.move(500, 300);
    await randomDelay(300, 500);

    // Followers from SSR JSON
    const profileData = await page.evaluate(() => {
      const scriptEl = document.querySelector(
        'script#__UNIVERSAL_DATA_FOR_REHYDRATION__'
      );
      if (scriptEl?.textContent) {
        try {
          const data = JSON.parse(scriptEl.textContent);
          const ud = data?.["__DEFAULT_SCOPE__"]?.["webapp.user-detail"];
          const followers = ud?.userInfo?.stats?.followerCount;
          if (followers !== undefined) return { followers: Number(followers) };
        } catch { /* */ }
      }
      // DOM fallback
      const strongEls = document.querySelectorAll("strong");
      for (const el of strongEls) {
        const next = el.nextElementSibling;
        if (
          next?.textContent?.includes("팔로워") ||
          next?.textContent?.toLowerCase().includes("follower")
        ) {
          return { followers: el.textContent?.trim() ?? null };
        }
      }
      return { followers: null };
    });

    if (profileData.followers !== null) {
      result.followers =
        typeof profileData.followers === "number"
          ? profileData.followers
          : parseNum(String(profileData.followers));
    }

    // --- Step 2: Try to get video data from intercepted API ---
    if (interceptedVideos.length > 0) {
      // Find first non-pinned video
      const video = interceptedVideos.find((v) => !v.isPinnedItem) ?? interceptedVideos[0];
      if (video) {
        if (video.createTime) {
          result.lastPostDate = new Date(video.createTime * 1000).toISOString().split("T")[0];
        }
        result.lastPostView = toNum(video.stats?.playCount);
        result.lastPostLike = toNum(video.stats?.diggCount);
        result.lastPostSave = toNum(video.stats?.collectCount);
      }
    }

    // --- Step 3: Fallback — try DOM video grid (may fail due to bot detection) ---
    if (result.lastPostView === null) {
      // Quick human-like scrolling to trigger content loading
      await page.evaluate(() => window.scrollBy(0, 300));
      await randomDelay(500, 800);
      await page.evaluate(() => window.scrollBy(0, 200));
      await randomDelay(500, 800);
      await page.evaluate(() => window.scrollBy(0, -300));
      await randomDelay(500, 800);

      const videoInfo = await page.evaluate(() => {
        const items = document.querySelectorAll('[data-e2e="user-post-item"]');
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const pinEl =
            item.querySelector('[data-e2e="video-card-badge"]') ||
            item.querySelector('svg[class*="pin"]') ||
            item.querySelector('[class*="PinnedIcon"]');
          if (pinEl) continue;

          const viewEl = item.querySelector(
            '[data-e2e="video-views"], strong.video-count'
          );
          const linkEl = item.querySelector('a[href*="/video/"]');
          return {
            href: linkEl?.getAttribute("href") ?? null,
            views: viewEl?.textContent?.trim() ?? null,
          };
        }
        return null;
      });

      if (videoInfo?.views) {
        result.lastPostView = parseNum(videoInfo.views);
      }

      // --- Step 4: Video detail page if we found a link ---
      if (videoInfo?.href) {
        const videoUrl = videoInfo.href.startsWith("http")
          ? videoInfo.href
          : `https://www.tiktok.com${videoInfo.href}`;

        // Shorter delay before navigating to video
        await randomDelay(1500, 2500);

        await page.goto(videoUrl, {
          waitUntil: "domcontentloaded",
          timeout: 30000
        });
        await randomDelay(1500, 2500);

        // Additional human-like behavior on video page
        await page.mouse.move(300, 400);
        await randomDelay(300, 500);

        const videoStats = await page.evaluate(() => {
          const scriptEl = document.querySelector(
            'script#__UNIVERSAL_DATA_FOR_REHYDRATION__'
          );
          if (scriptEl?.textContent) {
            try {
              const data = JSON.parse(scriptEl.textContent);
              const item =
                data?.["__DEFAULT_SCOPE__"]?.["webapp.video-detail"]?.itemInfo
                  ?.itemStruct;
              if (item) {
                return {
                  createTime: item.createTime ? Number(item.createTime) : null,
                  playCount: item.stats?.playCount ?? null,
                  diggCount: item.stats?.diggCount ?? null,
                  collectCount: item.stats?.collectCount ?? null,
                };
              }
            } catch { /* */ }
          }
          return null;
        });

        if (videoStats) {
          if (videoStats.createTime && result.lastPostDate === null) {
            result.lastPostDate = new Date(videoStats.createTime * 1000)
              .toISOString()
              .split("T")[0];
          }
          const ssrPlay = toNum(videoStats.playCount);
          if (ssrPlay !== null && ssrPlay > 0 && result.lastPostView === null) {
            result.lastPostView = ssrPlay;
          }
          if (result.lastPostLike === null) result.lastPostLike = toNum(videoStats.diggCount);
          if (result.lastPostSave === null) result.lastPostSave = toNum(videoStats.collectCount);
        }
      }
    }

    if (result.lastPostView === null) {
      console.warn(`[TikTok] Could not fetch video data for @${username} — bot detection likely active`);
    }

    return result;
  } catch (e) {
    console.error(`[TikTok] Error scraping @${username}:`, e);
    throw e;
  } finally {
    await context.close();
  }
}

// TikTok scraper with retry logic (exported for API use)
export async function scrapeTikTokWithRetry(username: string, maxRetries = 5): Promise<ScrapeResult> {
  let bestResult: ScrapeResult = emptyResult("tiktok", username);
  let bestScore = 0;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[TikTok] 🔄 Attempt ${attempt}/${maxRetries} for @${username}`);

      const result = await scrapeTikTok(username);

      // Count what we got
      const fields = {
        followers: result.followers !== null,
        date: result.lastPostDate !== null,
        view: result.lastPostView !== null,
        like: result.lastPostLike !== null,
        save: result.lastPostSave !== null
      };
      const currentScore = Object.values(fields).filter(Boolean).length;

      // Log what we found
      const gotFields = Object.entries(fields).filter(([_, v]) => v).map(([k]) => k).join(', ');
      console.log(`[TikTok] 📊 Got: ${gotFields || 'nothing'} (${currentScore}/5 fields)`);

      // Keep track of best result so far
      if (currentScore > bestScore) {
        bestResult = result;
        bestScore = currentScore;
        console.log(`[TikTok] 🎯 New best score: ${bestScore}/5`);
      }

      // SUCCESS: Got all 5 fields (followers + 4 video fields)
      if (currentScore === 5) {
        console.log(`[TikTok] ✅ Perfect! Got all data for @${username} on attempt ${attempt}`);
        return result;
      }

      // GOOD ENOUGH: Got followers + at least 3/4 video fields
      const videoDataCount = [fields.date, fields.view, fields.like, fields.save].filter(Boolean).length;
      if (result.followers !== null && videoDataCount >= 3) {
        console.log(`[TikTok] ✅ Good enough! Got followers + ${videoDataCount}/4 video fields`);
        return result;
      }

      // If not last attempt, retry
      if (attempt < maxRetries) {
        if (result.followers === null) {
          console.warn(`[TikTok] ⚠️ Missing followers (${currentScore}/5), retrying...`);
        } else if (videoDataCount === 0) {
          console.warn(`[TikTok] ⚠️ No video data (${currentScore}/5), retrying...`);
        } else {
          console.warn(`[TikTok] ⚠️ Incomplete (${currentScore}/5), need at least followers + 3 video fields, retrying...`);
        }

        // Progressive backoff: 2-4s, 4-7s, 6-10s, 8-13s, 10-16s
        const baseDelay = (attempt + 1) * 2000;
        const randomExtra = Math.floor(Math.random() * 3000);
        const totalDelay = baseDelay + randomExtra;
        console.log(`[TikTok] ⏳ Waiting ${(totalDelay / 1000).toFixed(1)}s before retry...`);
        await new Promise(r => setTimeout(r, totalDelay));
      } else {
        // Last attempt - return best result we got
        console.warn(`[TikTok] ⚠️ Max retries reached. Returning best result: ${bestScore}/5 fields`);
        return bestResult;
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error(`[TikTok] ❌ Error on attempt ${attempt}/${maxRetries} for @${username}: ${errMsg}`);

      if (attempt < maxRetries) {
        const baseDelay = (attempt + 1) * 2000;
        const randomExtra = Math.floor(Math.random() * 3000);
        await new Promise(r => setTimeout(r, baseDelay + randomExtra));
      }
    }
  }

  // All retries failed - return best result we managed to get
  if (bestScore > 0) {
    console.error(`[TikTok] ⛔ All ${maxRetries} attempts completed. Best result: ${bestScore}/5 fields`);
    return bestResult;
  }

  console.error(`[TikTok] ⛔ All ${maxRetries} attempts failed for @${username} - got nothing`);
  return emptyResult("tiktok", username);
}

// ============================================================
// Instagram — Playwright (profile page → followers from og:description)
// Note: Instagram requires login for most content. Without login,
// only og:description meta tag is accessible (provides follower count).
// Reel views/likes/dates require authenticated access.
// ============================================================
export async function scrapeInstagram(username: string): Promise<ScrapeResult> {
  const result = emptyResult("instagram", username);
  const context = await newContext();

  try {
    const page = await context.newPage();

    // Navigate to profile page (will redirect to login but og:description is still in HTML)
    await page.goto(`https://www.instagram.com/${username}/`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForTimeout(2000);

    // Followers from og:description (works even when redirected to login)
    const desc = await page.evaluate(() => {
      const m = document.querySelector('meta[property="og:description"]');
      return m?.getAttribute("content") ?? null;
    });
    if (desc) {
      // Korean: "팔로워 306명" or "팔로워 2,709명"
      const kr = desc.match(/팔로워\s+([\d,만.]+)\s*명/);
      if (kr) result.followers = parseNum(kr[1]);
      // English: "306 Followers"
      if (result.followers === null) {
        const en = desc.match(/([\d,KkMm.]+)\s+[Ff]ollowers/);
        if (en) result.followers = parseNum(en[1]);
      }
    }

    // Check if we're on the actual profile page (not login redirect)
    const currentUrl = page.url();
    const isLoggedOut = currentUrl.includes("/accounts/login") ||
      await page.evaluate(() => !!document.querySelector('input[name="username"]')).catch(() => true);

    // If not behind login wall, try to get reel data
    if (!isLoggedOut) {
      // Try reels page
      await page.goto(`https://www.instagram.com/${username}/reels/`, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      await page.waitForTimeout(3000);

      // First reel views + href
      const reelInfo = await page.evaluate(() => {
        const firstReel = document.querySelector('a[href*="/reel/"]');
        if (!firstReel) return null;
        const href = firstReel.getAttribute("href");
        const viewsOverlay = firstReel.querySelector("._aaj_");
        let views: string | null = null;
        if (viewsOverlay) {
          const text = viewsOverlay.textContent?.trim() || "";
          const nums = text.match(/(\d[\d,.KkMm만]*)/g);
          if (nums && nums.length > 0) views = nums[nums.length - 1];
        }
        return { href, views };
      });

      if (reelInfo?.views) {
        result.lastPostView = parseNum(reelInfo.views);
      }

      // Reel detail page → likes + date
      if (reelInfo?.href) {
        const reelUrl = reelInfo.href.startsWith("http")
          ? reelInfo.href
          : `https://www.instagram.com${reelInfo.href}`;

        await page.goto(reelUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(3000);

        try {
          const closeBtn = page.locator('button:has(img[alt="닫기"])');
          if (await closeBtn.isVisible({ timeout: 2000 })) {
            await closeBtn.click();
            await page.waitForTimeout(500);
          }
        } catch { /* */ }

        const reelStats = await page.evaluate(() => {
          let likes: string | null = null;
          let dateStr: string | null = null;
          const buttons = document.querySelectorAll("button");
          for (const btn of buttons) {
            const text = btn.textContent?.trim() || "";
            if (/^\d[\d,.KkMm만]*$/.test(text) && text.length < 20) {
              likes = text;
              break;
            }
          }
          const timeEls = document.querySelectorAll("time");
          for (const t of timeEls) {
            const text = t.textContent?.trim() || "";
            if (text.length > 1 && /\d/.test(text)) {
              dateStr = text;
            }
          }
          return { likes, dateStr };
        });

        if (reelStats.likes) result.lastPostLike = parseNum(reelStats.likes);
        if (reelStats.dateStr) result.lastPostDate = parseRelativeDate(reelStats.dateStr);
      }
    } else {
      console.warn(`[Instagram] Login wall detected for @${username} — only follower count available`);
    }
  } catch (e) {
    console.error(`[Instagram] Error scraping @${username}:`, e);
  } finally {
    await context.close();
  }

  return result;
}

// ============================================================
// YouTube — Playwright (Shorts tab → subscribers + latest short views/date/like)
// ============================================================
export async function scrapeYouTube(username: string): Promise<ScrapeResult> {
  const result = emptyResult("youtube", username);
  const context = await newContext();

  try {
    const page = await context.newPage();

    // --- Step 1: Shorts tab → subscribers + first short link/views ---
    await page.goto(`https://www.youtube.com/@${username}/shorts`, {
      waitUntil: "networkidle",
      timeout: 25000,
    });
    await page.waitForTimeout(2000);

    const channelData = await page.evaluate(() => {
      let subscribers: string | null = null;
      let firstShortHref: string | null = null;
      let firstShortViews: string | null = null;

      // Subscribers from channel header
      const spans = document.querySelectorAll("span, yt-formatted-string");
      for (const span of spans) {
        const text = span.textContent?.trim() || "";
        if (
          (text.includes("구독자") || text.toLowerCase().includes("subscriber")) &&
          /\d/.test(text) && text.length < 50
        ) {
          subscribers = text;
          break;
        }
      }

      // First Short: use ytm-shorts-lockup-view-model which contains
      // the title + "조회수 59회" text matching what users see on the channel page.
      const lockupModels = document.querySelectorAll("ytm-shorts-lockup-view-model");
      if (lockupModels.length > 0) {
        const firstModel = lockupModels[0];
        // Get the link href from within the model
        const linkEl = firstModel.querySelector('a[href*="/shorts/"]');
        if (linkEl) {
          const href = linkEl.getAttribute("href");
          if (href && /\/shorts\/[A-Za-z0-9_-]{5,}/.test(href)) {
            firstShortHref = href;
          }
        }
        // View count: text contains "조회수 59회" or "조회수 1.2만회"
        const fullText = firstModel.textContent || "";
        const viewMatch = fullText.match(/조회수\s*([\d,.만천억KkMm]+)\s*회?/);
        if (viewMatch) {
          firstShortViews = viewMatch[1];
        }
      }

      // Fallback: scan a[href] links if lockup model didn't work
      if (!firstShortHref) {
        const shortLinks = document.querySelectorAll('a[href*="/shorts/"]');
        for (const link of shortLinks) {
          const href = link.getAttribute("href");
          if (!href) continue;
          if (!/\/shorts\/[A-Za-z0-9_-]{5,}/.test(href)) continue;
          firstShortHref = href;
          break;
        }
      }

      return { subscribers, firstShortHref, firstShortViews };
    });

    if (channelData.subscribers) {
      const m = channelData.subscribers.match(/([\d,.만KkMm]+)/);
      if (m) result.followers = parseNum(m[1]);
    }
    if (channelData.firstShortViews) {
      const m = channelData.firstShortViews.match(/([\d,.만KkMm]+)/);
      if (m) result.lastPostView = parseNum(m[1]);
    }

    // --- Step 2: Short detail page → date + like count ---
    if (channelData.firstShortHref) {
      const shortUrl = channelData.firstShortHref.startsWith("http")
        ? channelData.firstShortHref
        : `https://www.youtube.com${channelData.firstShortHref}`;

      await page.goto(shortUrl, { waitUntil: "networkidle", timeout: 25000 });
      await page.waitForTimeout(2000);

      const shortStats = await page.evaluate(() => {
        let likes: string | null = null;
        let dateStr: string | null = null;
        let views: string | null = null;

        // YouTube Shorts detail page uses <factoid-renderer> elements with structure:
        //   <span class="ytwFactoidRendererValue">61</span>
        //   <span class="ytwFactoidRendererLabel">조회수</span>
        // Three factoids: 좋아요, 조회수, 날짜(전)
        const factoids = document.querySelectorAll("factoid-renderer");
        for (const factoid of factoids) {
          const valueEl = factoid.querySelector(".ytwFactoidRendererValue");
          const labelEl = factoid.querySelector(".ytwFactoidRendererLabel");
          if (!valueEl || !labelEl) continue;

          const value = valueEl.textContent?.trim() || "";
          const label = labelEl.textContent?.trim() || "";

          if (label === "좋아요" || label.toLowerCase() === "likes") {
            likes = value;
          } else if (label === "조회수" || label.toLowerCase().includes("view")) {
            views = value;
          } else if (label === "전" || label.toLowerCase() === "ago") {
            // value is like "8시간", "1일", "3주" — combine with label "전"
            dateStr = value + label;
          }
        }

        // Fallback: button aria-label for likes
        if (!likes) {
          const buttons = document.querySelectorAll("button");
          for (const btn of buttons) {
            const ariaLabel = btn.getAttribute("aria-label") || "";
            if (
              (ariaLabel.includes("좋아요") || ariaLabel.toLowerCase().includes("like")) &&
              /\d/.test(ariaLabel)
            ) {
              const m = ariaLabel.match(/([\d,.]+(?:\s*[만천억KkMm])?)\s*명/);
              if (m) likes = m[1].trim();
              break;
            }
          }
        }

        // Fallback: parse concatenated factoid text like "2좋아요61조회수7시간전"
        if (!views || !dateStr) {
          const allEls = document.querySelectorAll("span, div");
          for (const el of allEls) {
            const text = el.textContent?.trim() || "";
            if (text.length < 10 || text.length > 100) continue;
            if (text.includes("좋아요") && text.includes("조회수")) {
              if (!views) {
                const m = text.match(/(\d[\d,.만천억KkMm]*)\s*조회수/);
                if (m) views = m[1];
              }
              if (!dateStr) {
                const m = text.match(/(\d+\s*(?:일|시간|분|주|개월)\s*전)\s*$/);
                if (m) dateStr = m[1];
              }
              if (views && dateStr) break;
            }
          }
        }

        return { likes, dateStr, views };
      });

      if (shortStats.likes) result.lastPostLike = parseNum(shortStats.likes);
      if (shortStats.dateStr) result.lastPostDate = parseRelativeDate(shortStats.dateStr);
      // Update views from detail page if grid didn't provide them
      if (result.lastPostView === null && shortStats.views) {
        const m = shortStats.views.match(/([\d,.만KkMm]+)/);
        if (m) result.lastPostView = parseNum(m[1]);
      }
    }
  } catch (e) {
    console.error(`[YouTube] Error scraping @${username}:`, e);
  } finally {
    await context.close();
  }

  return result;
}

// ============================================================
// Facebook — Playwright (reels tab → followers + first reel views/date/like)
// ============================================================
export async function scrapeFacebook(username: string): Promise<ScrapeResult> {
  const result = emptyResult("facebook", username);
  const context = await newContext();

  try {
    const page = await context.newPage();

    // --- Step 1: Reels page → followers + first reel views + href ---
    // Support both username-based and ID-based profiles
    const isIdBased = /^\d+$/.test(username);
    const reelsUrl = isIdBased
      ? `https://www.facebook.com/profile.php?id=${username}&sk=reels`
      : `https://www.facebook.com/${username}/reels/`;

    await page.goto(reelsUrl, {
      waitUntil: "networkidle",
      timeout: 25000,
    });
    await page.waitForTimeout(3000);

    // Check if page loaded correctly (not "이 콘텐츠를 이용할 수 없습니다")
    const pageOk = await page.evaluate(() => {
      const h2s = document.querySelectorAll("h2");
      for (const h2 of h2s) {
        if (h2.textContent?.includes("이 콘텐츠를 이용할 수 없습니다")) return false;
      }
      return true;
    });

    if (!pageOk) {
      console.warn(`[Facebook] Page unavailable for ${username} via /reels/ URL`);
      await context.close();
      return result;
    }

    // Close login dialog if it appears
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
          const strongEl = el.querySelector("strong");
          if (strongEl) return strongEl.textContent?.trim() ?? null;
          const numMatch = text.match(/팔로워\s*([\d,.만KkMm]+)\s*명?/);
          if (numMatch) return numMatch[1];
          const enMatch = text.match(/([\d,.KkMm]+)\s+followers?/i);
          if (enMatch) return enMatch[1];
          const justNum = text.match(/([\d,]+)/);
          if (justNum) return justNum[1];
        }
      }
      return null;
    });

    if (followerData) {
      result.followers = parseNum(followerData);
    }

    // First reel: views + href
    const reelInfo = await page.evaluate(() => {
      const reelLinks = document.querySelectorAll('a[href*="/reel/"]');
      if (reelLinks.length === 0) return null;
      const firstReel = reelLinks[0];
      const href = firstReel.getAttribute("href");
      const text = firstReel.textContent?.trim() || "";
      const nums = text.match(/(\d[\d,.KkMm만]*)/g);
      const views = nums && nums.length > 0 ? nums[nums.length - 1] : null;
      return { href, views };
    });

    if (reelInfo?.views) {
      result.lastPostView = parseNum(reelInfo.views);
    }

    // --- Step 2: Reel detail page → date + like count ---
    if (reelInfo?.href) {
      const reelUrl = reelInfo.href.startsWith("http")
        ? reelInfo.href
        : `https://www.facebook.com${reelInfo.href}`;

      // Use domcontentloaded — Facebook reel detail pages never reach networkidle
      await page.goto(reelUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.waitForTimeout(4000);

      // Close login dialog if it appears (Facebook shows "더 많은 콘텐츠 보기" overlay)
      try {
        const closeBtn = page.locator('div[role="dialog"] button[aria-label="닫기"]');
        if (await closeBtn.isVisible({ timeout: 2000 })) {
          await closeBtn.click();
          await page.waitForTimeout(500);
        }
      } catch { /* */ }

      const reelStats = await page.evaluate(() => {
        let likes: string | null = null;
        let dateStr: string | null = null;

        // --- Likes ---
        // Strategy 1: labeled "좋아요 N개"
        const allSpans = document.querySelectorAll("span");
        for (const span of allSpans) {
          const text = span.textContent?.trim() || "";
          if (text.includes("좋아요") && /\d/.test(text) && text.length < 30) {
            const m = text.match(/([\d,.만천억KkMm]+)/);
            if (m) { likes = m[1]; break; }
          }
        }

        // Strategy 2: aria-label with like count
        if (!likes) {
          const elements = document.querySelectorAll("[aria-label]");
          for (const el of elements) {
            const label = el.getAttribute("aria-label") || "";
            if (
              (label.includes("좋아요") || label.toLowerCase().includes("like")) &&
              /\d/.test(label) && label.length < 50
            ) {
              const m = label.match(/([\d,.만천억KkMm]+)/);
              if (m) { likes = m[1]; break; }
            }
          }
        }

        // Strategy 3: Facebook reel pages without login show bare numbers
        // in the order: likes, comments, shares. The first standalone number
        // (leaf text node with only digits) that isn't part of a larger text is likes.
        if (!likes) {
          // Collect leaf-level spans/divs whose DIRECT text is just a number
          const leafEls = document.querySelectorAll("span, div");
          const bareNumbers: string[] = [];
          for (const el of leafEls) {
            // Only leaf elements (no child elements with text)
            if (el.children.length > 0) continue;
            const text = el.textContent?.trim() || "";
            if (/^[\d,.만천억KkMm]+$/.test(text) && text.length > 0 && text.length < 15) {
              bareNumbers.push(text);
            }
          }
          // First bare number is likes (Facebook order: likes, comments, shares)
          if (bareNumbers.length > 0) {
            likes = bareNumbers[0];
          }
        }

        // --- Date ---
        for (const span of allSpans) {
          const text = span.textContent?.trim() || "";
          if (/^\d+\s*(일|시간|분|주|개월)\s*전$/.test(text)) {
            dateStr = text;
            break;
          }
          if (/\d{4}년\s*\d{1,2}월\s*\d{1,2}일/.test(text) && text.length < 30) {
            const m = text.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
            if (m) { dateStr = `${m[1]}-${m[2]}-${m[3]}`; break; }
          }
          if (/\d{1,2},?\s*\d{4}/.test(text) && text.length < 30 && text.length > 5) {
            dateStr = text;
            break;
          }
        }

        // Fallback: elements with datetime/timestamp attributes
        if (!dateStr) {
          const timeEls = document.querySelectorAll("abbr[data-utime], time[datetime], [data-timestamp]");
          for (const el of timeEls) {
            const dt = el.getAttribute("datetime") || el.getAttribute("data-utime") || el.getAttribute("data-timestamp");
            if (dt) {
              const timestamp = Number(dt);
              if (!isNaN(timestamp) && timestamp > 1000000000) {
                dateStr = new Date(timestamp * 1000).toISOString().split("T")[0];
                break;
              }
              if (dt.includes("T") || dt.includes("-")) {
                dateStr = dt.split("T")[0];
                break;
              }
            }
          }
        }

        return { likes, dateStr };
      });

      if (reelStats.likes) result.lastPostLike = parseNum(reelStats.likes);
      if (reelStats.dateStr) result.lastPostDate = parseRelativeDate(reelStats.dateStr);
    }
  } catch (e) {
    console.error(`[Facebook] Error scraping ${username}:`, e);
  } finally {
    await context.close();
  }

  return result;
}
