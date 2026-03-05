-- KOKO SNS Dashboard — Supabase SQL Editor에서 실행
-- prisma db push 대신 수동으로 테이블 생성

-- 1. Region
CREATE TABLE IF NOT EXISTS "Region" (
  "code"      TEXT PRIMARY KEY,
  "name"      TEXT NOT NULL,
  "flagEmoji" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Language
CREATE TABLE IF NOT EXISTS "Language" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code"        TEXT NOT NULL UNIQUE,
  "label"       TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. RegionLanguage (join table)
CREATE TABLE IF NOT EXISTS "RegionLanguage" (
  "regionCode" TEXT NOT NULL REFERENCES "Region"("code") ON DELETE CASCADE,
  "languageId" UUID NOT NULL REFERENCES "Language"("id") ON DELETE CASCADE,
  PRIMARY KEY ("regionCode", "languageId")
);

-- 4. Platform
CREATE TABLE IF NOT EXISTS "Platform" (
  "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"               TEXT NOT NULL UNIQUE,
  "displayName"        TEXT NOT NULL,
  "iconName"           TEXT NOT NULL,
  "profileUrlTemplate" TEXT NOT NULL,
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Tag
CREATE TABLE IF NOT EXISTS "Tag" (
  "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "label"     TEXT NOT NULL UNIQUE,
  "color"     TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Account
CREATE TABLE IF NOT EXISTS "Account" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "platformId"   UUID NOT NULL REFERENCES "Platform"("id") ON DELETE CASCADE,
  "username"     TEXT NOT NULL,
  "regionCode"   TEXT NOT NULL REFERENCES "Region"("code") ON DELETE CASCADE,
  "languageCode" TEXT NOT NULL REFERENCES "Language"("code") ON DELETE CASCADE,
  "followers"    INTEGER,
  "lastPostDate" TEXT,
  "lastPostView" INTEGER,
  "lastPostLike" INTEGER,
  "lastPostSave" INTEGER,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("platformId", "username")
);

-- 7. AccountTag (join table)
CREATE TABLE IF NOT EXISTS "AccountTag" (
  "accountId" UUID NOT NULL REFERENCES "Account"("id") ON DELETE CASCADE,
  "tagId"     UUID NOT NULL REFERENCES "Tag"("id") ON DELETE CASCADE,
  PRIMARY KEY ("accountId", "tagId")
);
