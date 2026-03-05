# Windows Task Scheduler 자동 설정 스크립트
# Instagram/Facebook Keep-Alive 작업 생성

Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "Windows Task Scheduler 설정 시작" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""

# 경로 설정
$scriptPath = "C:\Users\wo840\OneDrive\바탕 화면\sns\mobile-qa-automation\dashboard"
$nodePath = "C:\Program Files\nodejs\node.exe"
$npxPath = "C:\Program Files\nodejs\npx.cmd"

# Node.js 경로 확인
if (-not (Test-Path $nodePath)) {
    Write-Host "ERROR: Node.js를 찾을 수 없습니다: $nodePath" -ForegroundColor Red
    Write-Host "Node.js 설치 경로를 확인해주세요." -ForegroundColor Yellow
    exit 1
}

Write-Host "[1/4] Instagram Keep-Alive 작업 생성 중..." -ForegroundColor Green

# Instagram Task 생성
$taskName = "SNS-KeepAlive-Instagram"
$action = New-ScheduledTaskAction -Execute $npxPath -Argument "tsx keep-alive.ts instagram" -WorkingDirectory $scriptPath

# 트리거 2개: 월요일 09:00, 목요일 14:00
$trigger1 = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At 09:00AM
$trigger2 = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Thursday -At 02:00PM

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest

# 기존 작업 삭제 (있을 경우)
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

# 작업 등록
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($trigger1, $trigger2) -Settings $settings -Principal $principal -Description "Instagram 세션 유지 (주 2회: 월 09:00, 목 14:00)"

Write-Host "✓ Instagram 작업 생성 완료" -ForegroundColor Green
Write-Host "  - 월요일 09:00" -ForegroundColor Gray
Write-Host "  - 목요일 14:00" -ForegroundColor Gray
Write-Host ""

Write-Host "[2/4] Facebook Keep-Alive 작업 생성 중..." -ForegroundColor Green

# Facebook Task 생성
$taskName = "SNS-KeepAlive-Facebook"
$action = New-ScheduledTaskAction -Execute $npxPath -Argument "tsx keep-alive.ts facebook" -WorkingDirectory $scriptPath

# 트리거 2개: 화요일 19:00, 금요일 21:00
$trigger1 = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Tuesday -At 07:00PM
$trigger2 = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Friday -At 09:00PM

# 기존 작업 삭제 (있을 경우)
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

# 작업 등록
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($trigger1, $trigger2) -Settings $settings -Principal $principal -Description "Facebook 세션 유지 (주 2회: 화 19:00, 금 21:00)"

Write-Host "✓ Facebook 작업 생성 완료" -ForegroundColor Green
Write-Host "  - 화요일 19:00" -ForegroundColor Gray
Write-Host "  - 금요일 21:00" -ForegroundColor Gray
Write-Host ""

Write-Host "[3/4] 작업 확인 중..." -ForegroundColor Green
Get-ScheduledTask | Where-Object { $_.TaskName -like "SNS-KeepAlive-*" } | Format-Table TaskName, State, @{Name="Next Run"; Expression={(Get-ScheduledTaskInfo $_).NextRunTime}}

Write-Host "[4/4] 설정 완료!" -ForegroundColor Green
Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "Task Scheduler 설정 완료" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "다음 명령어로 수동 테스트 가능:" -ForegroundColor Yellow
Write-Host "  Start-ScheduledTask -TaskName 'SNS-KeepAlive-Instagram'" -ForegroundColor Gray
Write-Host "  Start-ScheduledTask -TaskName 'SNS-KeepAlive-Facebook'" -ForegroundColor Gray
Write-Host ""
Write-Host "Task Scheduler 열기:" -ForegroundColor Yellow
Write-Host "  taskschd.msc" -ForegroundColor Gray
Write-Host ""
