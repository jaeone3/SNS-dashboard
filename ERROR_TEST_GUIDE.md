# 에러 테스트 가이드

## 🧪 테스트 모드 사용 방법

### 1. 브라우저 콘솔 열기
- Chrome/Edge: `F12` 또는 `Ctrl+Shift+I`
- Console 탭 선택

---

## 📋 테스트 명령어

### 테스트 모드 활성화

```javascript
// 네트워크 에러 시뮬레이션
localStorage.setItem('scrapeTestMode', 'network');

// 인증 실패 시뮬레이션
localStorage.setItem('scrapeTestMode', 'auth');

// 계정 없음 에러 시뮬레이션
localStorage.setItem('scrapeTestMode', 'notfound');

// Rate Limit 에러 시뮬레이션
localStorage.setItem('scrapeTestMode', 'ratelimit');

// 빈 데이터 반환 (모든 필드 null)
localStorage.setItem('scrapeTestMode', 'empty');
```

### 테스트 모드 비활성화

```javascript
localStorage.removeItem('scrapeTestMode');
```

### 현재 모드 확인

```javascript
localStorage.getItem('scrapeTestMode');
```

---

## 🎯 테스트 시나리오

### 시나리오 1: 일부 계정 실패 (추천)

1. **테스트 모드 활성화**
   ```javascript
   localStorage.setItem('scrapeTestMode', 'network');
   ```

2. **TikTok 계정 1-2개만 새로고침**
   - 개별 새로고침 버튼 클릭
   - 에러 발생 확인

3. **테스트 모드 비활성화**
   ```javascript
   localStorage.removeItem('scrapeTestMode');
   ```

4. **"Update" 버튼 클릭** (전체 새로고침)
   - 나머지 계정은 정상 스크래핑
   - Slack 메시지 확인:
     - 개별 에러 알림 (TikTok 계정들)
     - 일괄 알림 (성공한 계정 + 실패 요약)

---

### 시나리오 2: 모든 계정 실패

1. **테스트 모드 활성화**
   ```javascript
   localStorage.setItem('scrapeTestMode', 'auth');
   ```

2. **"Update" 버튼 클릭**
   - 모든 계정 스크래핑 실패
   - Slack 메시지 확인:
     - 개별 에러 알림 (모든 계정)
     - 일괄 알림 (빈 테이블 + 실패 요약만)

3. **테스트 모드 비활성화**
   ```javascript
   localStorage.removeItem('scrapeTestMode');
   ```

---

### 시나리오 3: 빈 데이터 테스트

1. **테스트 모드 활성화**
   ```javascript
   localStorage.setItem('scrapeTestMode', 'empty');
   ```

2. **개별 계정 새로고침**
   - 에러는 아니지만 데이터 없음
   - Toast: "no data could be fetched"

3. **테스트 모드 비활성화**
   ```javascript
   localStorage.removeItem('scrapeTestMode');
   ```

---

## 📊 예상 결과

### Slack 일괄 알림 (일부 실패)

```
📊 Daily Update - 2026-02-06

Platform  | Account               | Recent Posts | Views  | Shadow Ban
----------|-----------------------|--------------|--------|------------
YouTube   | @easy_korean_everyday | 2026-02-06   | 77     | BANNED
Instagram | @koko_contents        | 2026-02-05   | 2.2K   | OK
Facebook  | @KokoKorean           | -            | 117    | OK

Total: 3 accounts updated
Shadow Banned: 1 account

⚠️ Failed: 2 accounts
• TikTok - @korean_haru: Network timeout - simulated error
• TikTok - @koko_so061: Network timeout - simulated error

Updated: Feb 6, 2026 at 5:45 PM
```

### Slack 개별 에러 알림

```
🎵 TIKTOK Update Failed

❌ Scraping failed

Account: @korean_haru
Platform: TikTok

Error:
```
Network timeout - simulated error
```

Failed at: Feb 6, 2026 at 5:45 PM
```

---

## 🔧 에러 타입 설명

| 에러 타입 | 설명 | 메시지 |
|---------|------|--------|
| `network` | 네트워크 타임아웃 | Network timeout - simulated error |
| `auth` | 인증 실패 (세션 만료) | Authentication failed - simulated error |
| `notfound` | 계정 없음 | Account not found - simulated error |
| `ratelimit` | API 요청 제한 초과 | Rate limit exceeded - simulated error |
| `empty` | 데이터 없음 (에러 아님) | (모든 필드 null 반환) |

---

## ✅ 테스트 체크리스트

- [ ] 브라우저 콘솔에서 `localStorage.setItem('scrapeTestMode', 'network')` 실행
- [ ] 개별 계정 새로고침 → 에러 발생 확인
- [ ] Toast 알림 확인: "Failed to refresh ..."
- [ ] Slack 개별 에러 알림 확인
- [ ] `localStorage.removeItem('scrapeTestMode')` 실행
- [ ] "Update" 버튼 클릭 → 전체 새로고침
- [ ] Slack 일괄 알림 확인 (성공 계정 + 실패 요약)
- [ ] 실패 요약 섹션에 에러 메시지 표시 확인

---

## 🚨 주의사항

1. **테스트 후 반드시 비활성화**
   ```javascript
   localStorage.removeItem('scrapeTestMode');
   ```

2. **페이지 새로고침 불필요**
   - localStorage 변경 즉시 적용됨
   - 새로고침 버튼만 다시 클릭하면 됨

3. **실제 API 호출 안 함**
   - 모든 에러는 시뮬레이션
   - 외부 서비스(Apify, YouTube API 등)에 영향 없음
   - 스크래핑 할당량 소모 안 함

4. **DB는 업데이트 안 됨**
   - 에러 발생 시 DB에 변경사항 없음
   - 안전하게 테스트 가능

---

## 🎬 빠른 시작

1. 브라우저 콘솔 열기 (`F12`)
2. 다음 명령어 입력:
   ```javascript
   localStorage.setItem('scrapeTestMode', 'network');
   ```
3. Dashboard에서 개별 계정 새로고침 버튼 클릭
4. Slack 확인
5. 테스트 모드 비활성화:
   ```javascript
   localStorage.removeItem('scrapeTestMode');
   ```
6. "Update" 버튼 클릭 → 전체 결과 확인

---

## 📞 문제 해결

**Q: 에러가 발생하지 않아요**
- Console에서 `localStorage.getItem('scrapeTestMode')` 확인
- 값이 null이면 다시 설정: `localStorage.setItem('scrapeTestMode', 'network')`

**Q: 모든 계정이 실패해요**
- `localStorage.removeItem('scrapeTestMode')` 실행
- 페이지 새로고침 (F5)

**Q: Slack 메시지가 안 와요**
- `.env.local`에서 `SLACK_WEBHOOK_URL` 확인
- 브라우저 콘솔에서 에러 로그 확인
