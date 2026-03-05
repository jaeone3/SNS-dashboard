# SNS Dashboard

SNS 계정 조회수/팔로워 트래킹 대시보드. Next.js 16 + Prisma + Supabase 기반.

## 기술 스택

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS, Radix UI
- **Backend**: Next.js API Routes, Prisma ORM
- **DB**: Supabase PostgreSQL
- **State**: Zustand
- **Scraping**: Puppeteer (Instagram/Facebook), Apify (TikTok), YouTube Data API v3

## 요구사항

- Node.js 20+
- npm 10+
- Chrome/Chromium (Instagram/Facebook 스크래핑용)

## 설치

```bash
git clone https://github.com/jaeone3/SNS-dashboard.git
cd SNS-dashboard
npm install
npx playwright install chromium
```

## 환경변수 설정

`.env.example`을 복사해서 `.env` 파일을 만들고 값을 채워주세요.

```bash
cp .env.example .env
```

| 변수 | 용도 | 필수 | 발급처 |
|------|------|------|--------|
| `DATABASE_URL` | Supabase PostgreSQL 연결 | O | [supabase.com](https://supabase.com) |
| `DIRECT_URL` | Prisma 마이그레이션 직접 연결 | O | Supabase 대시보드 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL | O | Supabase 대시보드 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 공개 키 | O | Supabase 대시보드 |
| `APIFY_API_TOKEN` | TikTok 스크래핑 | O | [apify.com](https://apify.com) |
| `YOUTUBE_API_KEY` | YouTube 조회수 수집 | O | [Google Cloud Console](https://console.cloud.google.com) |
| `SLACK_WEBHOOK_URL` | Slack 알림 (선택) | X | [Slack API](https://api.slack.com/messaging/webhooks) |

## DB 설정

> 기존 DB를 공유받은 경우 (`.env`를 전달받은 경우) 이 단계는 건너뛰고 바로 실행으로 가세요. 테이블과 데이터가 이미 존재합니다.

새로운 Supabase DB를 직접 만드는 경우:

```bash
# 1. 테이블 생성
npx prisma db push

# 2. Prisma 클라이언트 생성
npx prisma generate

# 3. 초기 데이터 삽입 (선택)
npx tsx scripts/seed.ts
```

또는 Supabase SQL Editor에서 `prisma/create-tables.sql`을 직접 실행해도 됩니다.

## 실행

```bash
npm install
npm run dev
```

http://localhost:3000 에서 확인.

## Instagram / Facebook 로그인 설정

Instagram, Facebook 스크래핑은 API가 아닌 브라우저 세션 기반입니다. 최초 1회 수동 로그인이 필요합니다.

### 1단계: 로그인 브라우저 열기

대시보드 UI에서 로그인 버튼을 클릭하거나, API를 직접 호출합니다:

```bash
# 브라우저 열기 (수동 로그인 진행)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"platform": "instagram", "accountId": "acc_001"}'
```

브라우저가 뜨면 직접 로그인합니다.

### 2단계: 로그인 브라우저 닫기 (세션 저장)

로그인 완료 후:

```bash
curl -X DELETE http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"platform": "instagram"}'
```

세션이 `~/.sns-dashboard-profiles/[platform]/[accountId]/`에 저장됩니다.

### 3단계: 로그인 상태 확인

```bash
curl http://localhost:3000/api/auth/status
# {"instagram": true, "facebook": false}
```

## 로그인 세션 유지 (Keep-Alive)

로그인 세션은 시간이 지나면 만료됩니다. keep-alive 스크립트로 세션 수명을 연장할 수 있습니다.

- keep-alive 없이: 3개월 ~ 6개월
- keep-alive 사용 시 (주 2회): 9개월 ~ 12개월+

### accounts.json 설정

`accounts.json.example`을 복사해서 `accounts.json`을 만들고 본인 정보로 수정합니다:

```bash
cp accounts.json.example accounts.json
```

```json
[
  {
    "id": "acc_001",
    "platform": "instagram",
    "username": "your_username",
    "profileDir": "C:\\Users\\[사용자명]\\.sns-dashboard-profiles\\instagram\\acc_001",
    "lastActivity": ""
  }
]
```

`profileDir`은 본인 OS의 홈 디렉토리에 맞게 수정하세요:
- Windows: `C:\\Users\\[사용자명]\\.sns-dashboard-profiles\\...`
- Mac/Linux: `/home/[사용자명]/.sns-dashboard-profiles/...`

### 수동 실행

```bash
npx tsx keep-alive.ts instagram
npx tsx keep-alive.ts facebook
```

### 자동화

#### Windows (작업 스케줄러)

관리자 PowerShell에서:

```powershell
powershell -ExecutionPolicy Bypass -File setup-scheduler-with-logs.ps1
```

#### Mac / Linux (cron)

```bash
crontab -e
```

아래 내용을 추가합니다. `/path/to/dashboard`는 실제 프로젝트 경로로 변경하세요:

```cron
# Instagram: 월요일 09:00, 목요일 14:00
0 9 * * 1 cd /path/to/dashboard && npx tsx keep-alive.ts instagram >> logs/instagram-$(date +\%Y-\%m-\%d).log 2>&1
0 14 * * 4 cd /path/to/dashboard && npx tsx keep-alive.ts instagram >> logs/instagram-$(date +\%Y-\%m-\%d).log 2>&1

# Facebook: 화요일 19:00, 금요일 21:00
0 19 * * 2 cd /path/to/dashboard && npx tsx keep-alive.ts facebook >> logs/facebook-$(date +\%Y-\%m-\%d).log 2>&1
0 21 * * 5 cd /path/to/dashboard && npx tsx keep-alive.ts facebook >> logs/facebook-$(date +\%Y-\%m-\%d).log 2>&1
```

#### 기본 스케줄

| 플랫폼 | 실행 시간 |
|--------|----------|
| Instagram | 월요일 09:00, 목요일 14:00 |
| Facebook | 화요일 19:00, 금요일 21:00 |

로그 확인: `logs/instagram-YYYY-MM-DD.log`

### 세션 만료 감지

keep-alive 실행 시 로그인 페이지로 리다이렉트되면 세션이 만료된 것입니다. 로그에 다음 메시지가 출력됩니다:

```
ERROR: Session expired! Redirected to login page.
Please re-login via /api/auth/login
```

이 경우 위의 "Instagram / Facebook 로그인 설정"부터 다시 진행하세요.

## 프로젝트 구조

```
dashboard/
  app/              # Next.js App Router (페이지 + API)
    api/            # REST API 엔드포인트
    page.tsx        # 메인 대시보드 페이지
  components/       # React 컴포넌트
    common/         # 공통 컴포넌트 (TagBadge, PlatformIcon 등)
    dashboard/      # 대시보드 전용 컴포넌트
    manage/         # 관리 패널 컴포넌트
    ui/             # shadcn/ui 기본 컴포넌트
  lib/              # 유틸리티 및 서버 로직
    scraper.ts      # 플랫폼별 스크래핑 모듈
    slack-notifier.ts # Slack 알림
    db.ts           # Prisma 클라이언트
  prisma/           # DB 스키마 및 SQL
  stores/           # Zustand 상태 관리
  scripts/          # Seed 스크립트
  keep-alive.ts     # 세션 유지 스크립트
```
