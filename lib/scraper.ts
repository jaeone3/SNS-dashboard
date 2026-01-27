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
    _browser = await chromium.launch({
      headless: true,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-setuid-sandbox",
      ],
    });
  }
  return _browser;
}

async function newContext(): Promise<BrowserContext> {
  const browser = await getBrowser();
  return browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "ko-KR",
    viewport: { width: 1280, height: 720 },
  });
}

// ============================================================
// Helpers
// ============================================================
function parseNum(s: string | null | undefined): number | null {
  if (!s) return null;
  const t = s.replace(/,/g, "").trim();
  const manMatch = t.match(/^([\d.]+)\s*만$/);
  if (manMatch) return Math.round(parseFloat(manMatch[1]) * 10000);
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
// TikTok — Playwright (profile + video detail)
// ============================================================
export async function scrapeTikTok(username: string): Promise<ScrapeResult> {
  const result = emptyResult("tiktok", username);
  const context = await newContext();

  try {
    const page = await context.newPage();

    // --- Step 1: Profile page → followers + video list ---
    await page.goto(`https://www.tiktok.com/@${username}`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    const profileData = await page.evaluate(() => {
      // SSR JSON
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

    // --- Step 2: Find first non-pinned video ---
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

    // --- Step 3: Video detail page → date, like, save ---
    if (videoInfo?.href) {
      const videoUrl = videoInfo.href.startsWith("http")
        ? videoInfo.href
        : `https://www.tiktok.com${videoInfo.href}`;

      await page.goto(videoUrl, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2000);

      // SSR JSON
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
        if (videoStats.createTime) {
          result.lastPostDate = new Date(videoStats.createTime * 1000)
            .toISOString()
            .split("T")[0];
        }
        // Only use SSR playCount if it's > 0 and we don't already have a value
        const ssrPlay = toNum(videoStats.playCount);
        if (ssrPlay !== null && ssrPlay > 0 && result.lastPostView === null) {
          result.lastPostView = ssrPlay;
        }
        result.lastPostLike = toNum(videoStats.diggCount);
        result.lastPostSave = toNum(videoStats.collectCount);
      }

      // DOM fallback for like/save
      if (result.lastPostLike === null || result.lastPostSave === null) {
        const domStats = await page.evaluate(() => {
          const buttons = document.querySelectorAll("button");
          let like: string | null = null;
          let save: string | null = null;
          for (const btn of buttons) {
            const label = btn.getAttribute("aria-label") || "";
            const strongEl = btn.querySelector("strong");
            const val = strongEl?.textContent?.trim() ?? null;
            if (label.includes("좋아요") || label.includes("like")) like = val;
            if (label.includes("즐겨찾기") || label.includes("bookmark") || label.includes("favorite")) save = val;
          }
          return { like, save };
        });
        if (result.lastPostLike === null && domStats.like) result.lastPostLike = parseNum(domStats.like);
        if (result.lastPostSave === null && domStats.save) result.lastPostSave = parseNum(domStats.save);
      }

      // DOM fallback for date
      if (result.lastPostDate === null) {
        const dateText = await page.evaluate(() => {
          const els = document.querySelectorAll("span, div");
          for (const el of els) {
            const text = el.textContent?.trim() || "";
            if (/^·\s*\d/.test(text) && text.length < 30) return text.replace(/^·\s*/, "");
            if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(text)) return text;
          }
          return null;
        });
        if (dateText) result.lastPostDate = parseRelativeDate(dateText);
      }
    }
  } catch (e) {
    console.error(`[TikTok] Error scraping @${username}:`, e);
  } finally {
    await context.close();
  }

  return result;
}

// ============================================================
// Instagram — Playwright (reels page → followers + reel stats)
// ============================================================
export async function scrapeInstagram(username: string): Promise<ScrapeResult> {
  const result = emptyResult("instagram", username);
  const context = await newContext();

  try {
    const page = await context.newPage();

    // --- Step 1: Reels page → followers + first reel views ---
    await page.goto(`https://www.instagram.com/${username}/reels/`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForTimeout(3000);

    // Followers from og:description
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

    // Fallback: DOM links "팔로워 306"
    if (result.followers === null) {
      const domFollowers = await page.evaluate(() => {
        const links = document.querySelectorAll("a");
        for (const a of links) {
          const text = a.textContent?.trim() || "";
          const m = text.match(/팔로워\s*([\d,만KkMm.]+)/);
          if (m) return m[1];
          const en = text.match(/([\d,KkMm.]+)\s*followers?/i);
          if (en) return en[1];
        }
        return null;
      });
      if (domFollowers) result.followers = parseNum(domFollowers);
    }

    // First reel views + href
    const reelInfo = await page.evaluate(() => {
      const firstReel = document.querySelector('a[href*="/reel/"]');
      if (!firstReel) return null;
      const href = firstReel.getAttribute("href");

      // Views from ._aaj_ overlay (bottom overlay with view count)
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

    // --- Step 2: Reel detail page → likes + date ---
    if (reelInfo?.href) {
      const reelUrl = reelInfo.href.startsWith("http")
        ? reelInfo.href
        : `https://www.instagram.com${reelInfo.href}`;

      await page.goto(reelUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(3000);

      // Close signup dialog
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

        // Like count: button containing just a number
        const buttons = document.querySelectorAll("button");
        for (const btn of buttons) {
          const text = btn.textContent?.trim() || "";
          if (/^\d[\d,.KkMm만]*$/.test(text) && text.length < 20) {
            likes = text;
            break;
          }
        }

        // Date from <time> elements
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
  } catch (e) {
    console.error(`[Instagram] Error scraping @${username}:`, e);
  } finally {
    await context.close();
  }

  return result;
}

// ============================================================
// YouTube — Playwright (DOM → subscribers + latest video views)
// ============================================================
export async function scrapeYouTube(username: string): Promise<ScrapeResult> {
  const result = emptyResult("youtube", username);
  const context = await newContext();

  try {
    const page = await context.newPage();
    await page.goto(`https://www.youtube.com/@${username}`, {
      waitUntil: "networkidle",
      timeout: 25000,
    });
    await page.waitForTimeout(2000);

    const channelData = await page.evaluate(() => {
      let subscribers: string | null = null;
      let latestViews: string | null = null;

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

      const allEls = document.querySelectorAll("span, yt-formatted-string");
      for (const el of allEls) {
        const text = el.textContent?.trim() || "";
        if (
          (text.includes("조회수") || text.toLowerCase().includes("view")) &&
          /\d/.test(text) && text.length < 50
        ) {
          latestViews = text;
          break;
        }
      }

      return { subscribers, latestViews };
    });

    if (channelData.subscribers) {
      const m = channelData.subscribers.match(/([\d,.만KkMm]+)/);
      if (m) result.followers = parseNum(m[1]);
    }
    if (channelData.latestViews) {
      const m = channelData.latestViews.match(/([\d,.만KkMm]+)/);
      if (m) result.lastPostView = parseNum(m[1]);
    }
  } catch (e) {
    console.error(`[YouTube] Error scraping @${username}:`, e);
  } finally {
    await context.close();
  }

  return result;
}

// ============================================================
// Facebook — Playwright (reels tab → followers + first reel views)
// ============================================================
export async function scrapeFacebook(username: string): Promise<ScrapeResult> {
  const result = emptyResult("facebook", username);
  const context = await newContext();

  try {
    const page = await context.newPage();

    // Try /{username}/reels/ first (works for Pages)
    // If it fails or shows error, try the profile page with reels_tab
    await page.goto(`https://www.facebook.com/${username}/reels/`, {
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
      // Content unavailable — this username might need profile.php?id= format
      // Can't auto-resolve ID from username without login, so return empty
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

    // Followers: <a> containing "팔로워" with <strong> number
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

    // First reel views from reel cards
    const reelView = await page.evaluate(() => {
      const reelLinks = document.querySelectorAll('a[href*="/reel/"]');
      if (reelLinks.length === 0) return null;
      const firstReel = reelLinks[0];
      const text = firstReel.textContent?.trim() || "";
      // The reel card shows just a number (view count)
      const nums = text.match(/(\d[\d,.KkMm만]*)/g);
      if (nums && nums.length > 0) return nums[nums.length - 1];
      return null;
    });

    if (reelView) {
      result.lastPostView = parseNum(reelView);
    }
  } catch (e) {
    console.error(`[Facebook] Error scraping ${username}:`, e);
  } finally {
    await context.close();
  }

  return result;
}
