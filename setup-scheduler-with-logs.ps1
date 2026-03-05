# Windows Task Scheduler 자동 설정 스크립트 (로그 파일 포함)
# Instagram/Facebook Keep-Alive 작업 생성

Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "Windows Task Scheduler 설정 시작 (로그 파일 포함)" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""

# 경로 설정
$scriptPath = $PSScriptRoot
$logDir = Join-Path $scriptPath "logs"
$npxPath = "C:\Program Files\nodejs\npx.cmd"

Write-Host "스크립트 경로: $scriptPath" -ForegroundColor Gray
Write-Host "로그 경로: $logDir" -ForegroundColor Gray
Write-Host ""

# 로그 디렉토리 생성
if (-not (Test-Path -LiteralPath $logDir)) {
    try {
        New-Item -ItemType Directory -Path $logDir -Force -ErrorAction Stop | Out-Null
        Write-Host "✓ 로그 디렉토리 생성: $logDir" -ForegroundColor Green
    } catch {
        Write-Host "ERROR: 로그 디렉토리 생성 실패: $_" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✓ 로그 디렉토리 존재: $logDir" -ForegroundColor Green
}

# Node.js 경로 확인
if (-not (Test-Path $npxPath)) {
    Write-Host "ERROR: npx를 찾을 수 없습니다: $npxPath" -ForegroundColor Red
    Write-Host "Node.js 설치 경로를 확인해주세요." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "[1/4] Instagram Keep-Alive 작업 생성 중..." -ForegroundColor Green

# Instagram Task 생성 (로그 파일 리다이렉션 포함)
$taskName = "SNS-KeepAlive-Instagram"
$commandScript = @"
Set-Location -LiteralPath '$scriptPath'
`$logFile = Join-Path '$logDir' "instagram-`$(Get-Date -Format 'yyyy-MM-dd').log"
& npx tsx keep-alive.ts instagram 2>&1 | Tee-Object -FilePath `$logFile -Append
"@
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -Command `"$commandScript`"" -WorkingDirectory $scriptPath

# 트리거 2개: 월요일 09:00, 목요일 14:00
$trigger1 = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At 09:00AM
$trigger2 = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Thursday -At 02:00PM

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest

# 기존 작업 삭제 (있을 경우)
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

# 작업 등록
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($trigger1, $trigger2) -Settings $settings -Principal $principal -Description "Instagram 세션 유지 (주 2회: 월 09:00, 목 14:00) - 로그: $logDir"

Write-Host "✓ Instagram 작업 생성 완료" -ForegroundColor Green
Write-Host "  - 월요일 09:00" -ForegroundColor Gray
Write-Host "  - 목요일 14:00" -ForegroundColor Gray
Write-Host "  - 로그: $logDir\instagram-YYYY-MM-DD.log" -ForegroundColor Gray
Write-Host ""

Write-Host "[2/4] Facebook Keep-Alive 작업 생성 중..." -ForegroundColor Green

# Facebook Task 생성 (로그 파일 리다이렉션 포함)
$taskName = "SNS-KeepAlive-Facebook"
$commandScript = @"
Set-Location -LiteralPath '$scriptPath'
`$logFile = Join-Path '$logDir' "facebook-`$(Get-Date -Format 'yyyy-MM-dd').log"
& npx tsx keep-alive.ts facebook 2>&1 | Tee-Object -FilePath `$logFile -Append
"@
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -Command `"$commandScript`"" -WorkingDirectory $scriptPath

# 트리거 2개: 화요일 19:00, 금요일 21:00
$trigger1 = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Tuesday -At 07:00PM
$trigger2 = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Friday -At 09:00PM

# 기존 작업 삭제 (있을 경우)
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

# 작업 등록
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($trigger1, $trigger2) -Settings $settings -Principal $principal -Description "Facebook 세션 유지 (주 2회: 화 19:00, 금 21:00) - 로그: $logDir"

Write-Host "✓ Facebook 작업 생성 완료" -ForegroundColor Green
Write-Host "  - 화요일 19:00" -ForegroundColor Gray
Write-Host "  - 금요일 21:00" -ForegroundColor Gray
Write-Host "  - 로그: $logDir\facebook-YYYY-MM-DD.log" -ForegroundColor Gray
Write-Host ""

Write-Host "[3/4] 작업 확인 중..." -ForegroundColor Green
Get-ScheduledTask | Where-Object { $_.TaskName -like "SNS-KeepAlive-*" } | Format-Table TaskName, State, @{Name="Next Run"; Expression={(Get-ScheduledTaskInfo $_).NextRunTime}}

Write-Host "[4/4] 설정 완료!" -ForegroundColor Green
Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "Task Scheduler 설정 완료 (로그 파일 포함)" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "로그 파일 위치:" -ForegroundColor Yellow
Write-Host "  $logDir" -ForegroundColor Gray
Write-Host ""
Write-Host "로그 파일 예시:" -ForegroundColor Yellow
Write-Host "  instagram-2026-02-10.log" -ForegroundColor Gray
Write-Host "  facebook-2026-02-06.log" -ForegroundColor Gray
Write-Host ""
Write-Host "로그 확인 방법:" -ForegroundColor Yellow
Write-Host "  Get-Content (Join-Path '$logDir' 'instagram-`$(Get-Date -Format ''yyyy-MM-dd'').log')" -ForegroundColor Gray
Write-Host "  Get-Content (Join-Path '$logDir' 'facebook-`$(Get-Date -Format ''yyyy-MM-dd'').log')" -ForegroundColor Gray
Write-Host ""
Write-Host "수동 테스트:" -ForegroundColor Yellow
Write-Host "  Start-ScheduledTask -TaskName 'SNS-KeepAlive-Instagram'" -ForegroundColor Gray
Write-Host "  Start-ScheduledTask -TaskName 'SNS-KeepAlive-Facebook'" -ForegroundColor Gray
Write-Host ""
Write-Host "Task Scheduler 열기:" -ForegroundColor Yellow
Write-Host "  taskschd.msc" -ForegroundColor Gray
Write-Host ""
