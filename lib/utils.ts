import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function formatNumber(n: number | null): string {
  if (n === null || n === undefined) return "-";
  return n.toLocaleString("en-US");
}

export function formatDate(d: string | null): string {
  if (!d) return "-";
  return d; // Already in YYYY-MM-DD format
}

export function nowISO(): string {
  return new Date().toISOString();
}

// ===== SNS Link Parser =====

export interface ParsedSNSLink {
  platformName: string; // "tiktok", "instagram", "youtube", "x"
  username: string;
}

/**
 * SNS URL/링크 패턴 정의.
 * 각 플랫폼의 프로필 URL에서 username을 추출합니다.
 */
const SNS_PATTERNS: {
  platformName: string;
  patterns: RegExp[];
}[] = [
  {
    platformName: "tiktok",
    patterns: [
      /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_.]+)/i,
      /(?:https?:\/\/)?(?:vm\.)?tiktok\.com\/@([a-zA-Z0-9_.]+)/i,
    ],
  },
  {
    platformName: "instagram",
    patterns: [
      /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)\/?/i,
    ],
  },
  {
    platformName: "youtube",
    patterns: [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/@([a-zA-Z0-9_.-]+)/i,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/channel\/([a-zA-Z0-9_-]+)/i,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/c\/([a-zA-Z0-9_.-]+)/i,
    ],
  },
  {
    platformName: "x",
    patterns: [
      /(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/([a-zA-Z0-9_]+)\/?/i,
    ],
  },
  {
    platformName: "facebook",
    patterns: [
      /(?:https?:\/\/)?(?:www\.)?facebook\.com\/([a-zA-Z0-9_.]+)\/?/i,
    ],
  },
];

/**
 * SNS 프로필 URL을 파싱하여 플랫폼 이름과 username을 반환합니다.
 * 인식 불가능한 경우 null을 반환합니다.
 */
export function parseSNSLink(input: string): ParsedSNSLink | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  for (const { platformName, patterns } of SNS_PATTERNS) {
    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match && match[1]) {
        return {
          platformName,
          username: match[1],
        };
      }
    }
  }

  return null;
}

/**
 * 입력값이 URL처럼 보이는지 판단합니다.
 */
export function looksLikeURL(input: string): boolean {
  const trimmed = input.trim();
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.includes("tiktok.com") ||
    trimmed.includes("instagram.com") ||
    trimmed.includes("youtube.com") ||
    trimmed.includes("twitter.com") ||
    trimmed.includes("x.com") ||
    trimmed.includes("facebook.com")
  );
}
