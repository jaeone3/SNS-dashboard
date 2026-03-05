# Oracle Cloud Deployment Guide

Complete guide to deploy the Instagram/Facebook session keep-alive system on Oracle Cloud's Always Free tier.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Phase 1: Oracle Cloud Setup](#phase-1-oracle-cloud-setup)
4. [Phase 2: Server Configuration](#phase-2-server-configuration)
5. [Phase 3: Project Deployment](#phase-3-project-deployment)
6. [Phase 4: Browser Profile Setup](#phase-4-browser-profile-setup)
7. [Phase 5: Keep-Alive Automation](#phase-5-keep-alive-automation)
8. [Phase 6: Monitoring & Maintenance](#phase-6-monitoring--maintenance)
9. [Troubleshooting](#troubleshooting)

---

## Overview

### What This Deployment Does

- **Extends session lifetime**: Cookie-based (1-3 months) → User Data Directory + Keep-Alive (9-12+ months)
- **Automated maintenance**: Keep-Alive script runs every 12 hours via Cron
- **24/7 availability**: Hosted on Oracle Cloud's permanent free tier
- **Resource efficient**: Uses ~1-2% of free tier limits (2 accounts)

### Architecture

```
Oracle Cloud VM (Ubuntu 22.04)
├── Next.js Dashboard (Port 3000)
│   └── Scraping API (Instagram/Facebook)
├── Browser Profiles (~/.sns-dashboard-profiles/)
│   ├── instagram/acc_001/
│   └── facebook/acc_001/
├── Keep-Alive Script (keep-alive.ts)
└── Cron Job (runs every 12 hours)
```

---

## Prerequisites

### Required Accounts

- [ ] Oracle Cloud account (free tier)
- [ ] Instagram account (for scraping)
- [ ] Facebook account (for scraping)

### Local Tools

- [ ] Git
- [ ] SSH client (PuTTY on Windows, built-in on Mac/Linux)
- [ ] WinSCP or FileZilla (for file transfers)

### API Keys (already have)

- [ ] `APIFY_API_TOKEN` (TikTok scraping)
- [ ] `YOUTUBE_API_KEY` (YouTube scraping)
- [ ] `DATABASE_URL` (PostgreSQL connection)

---

## Phase 1: Oracle Cloud Setup

**Duration**: 20-30 minutes

### Step 1.1: Create Oracle Cloud Account

1. Go to https://www.oracle.com/cloud/free/
2. Click **Start for free**
3. Fill in registration form:
   - Country: Korea (South)
   - Email: Your email
   - Password: Strong password
4. Verify email
5. **IMPORTANT**: Provide payment card (won't be charged for free tier)
6. Complete account setup

### Step 1.2: Create SSH Key Pair (Windows)

```powershell
# Open PowerShell
cd ~\.ssh

# Generate SSH key (press Enter for all prompts)
ssh-keygen -t rsa -b 4096 -f oracle_cloud_key

# You now have:
# - oracle_cloud_key (private key - KEEP SECRET)
# - oracle_cloud_key.pub (public key - upload to Oracle)
```

View public key:
```powershell
type oracle_cloud_key.pub
```

Copy the entire output (starts with `ssh-rsa`).

### Step 1.3: Create Compute Instance (VM)

1. Login to Oracle Cloud Console
2. Navigate: **Menu** → **Compute** → **Instances**
3. Click **Create Instance**

**Configuration**:

| Setting | Value |
|---------|-------|
| Name | `sns-dashboard-server` |
| Placement | Keep default |
| Image | **Canonical Ubuntu 22.04** |
| Shape | **Ampere (ARM)** → **VM.Standard.A1.Flex** |
| OCPUs | **2** |
| Memory (GB) | **12** |
| Boot volume | 50 GB (default) |
| Network | Keep default (VCN auto-created) |
| Public IP | ✅ **Assign public IPv4** |
| SSH Keys | ✅ **Paste public keys** → Paste your public key |

4. Click **Create**
5. Wait 2-3 minutes for provisioning

### Step 1.4: Note Down Server Details

After instance is **Running**:

```
Public IP: 123.45.67.89  (SAVE THIS)
Username: ubuntu
SSH Key: ~/.ssh/oracle_cloud_key
```

### Step 1.5: Configure Firewall

**Ingress Rules** (allow incoming traffic):

1. Click instance name → **Virtual cloud network** → **Subnet** → **Default Security List**
2. Click **Add Ingress Rules**

Add these rules:

| Source CIDR | Destination Port | Description |
|-------------|------------------|-------------|
| `0.0.0.0/0` | `22` | SSH |
| `0.0.0.0/0` | `3000` | Next.js Dashboard |

3. Click **Add Ingress Rules**

**Ubuntu Firewall** (configure later via SSH):

```bash
sudo ufw allow 22/tcp
sudo ufw allow 3000/tcp
sudo ufw enable
```

---

## Phase 2: Server Configuration

**Duration**: 30-40 minutes

### Step 2.1: Connect via SSH

**Windows (PowerShell)**:
```powershell
ssh -i ~\.ssh\oracle_cloud_key ubuntu@123.45.67.89
```

**Mac/Linux**:
```bash
chmod 400 ~/.ssh/oracle_cloud_key
ssh -i ~/.ssh/oracle_cloud_key ubuntu@123.45.67.89
```

First login prompts:
```
Are you sure you want to continue connecting? (yes/no) → yes
```

### Step 2.2: System Update

```bash
# Update package list
sudo apt update

# Upgrade existing packages
sudo apt upgrade -y

# Install essential tools
sudo apt install -y curl wget git vim htop unzip build-essential
```

### Step 2.3: Install Node.js 20.x

```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x
```

### Step 2.4: Install Chromium Dependencies

```bash
# Install Chromium browser dependencies for Puppeteer
sudo apt install -y \
  chromium-browser \
  libnss3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libpangocairo-1.0-0 \
  libgtk-3-0 \
  fonts-liberation \
  xdg-utils
```

### Step 2.5: Install PM2 (Process Manager)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Verify installation
pm2 --version
```

### Step 2.6: Configure Swap (Optional but Recommended)

```bash
# Create 2GB swap file
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make swap permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verify swap
free -h
```

---

## Phase 3: Project Deployment

**Duration**: 15-20 minutes

### Step 3.1: Prepare Local Project

**On your local PC**:

```powershell
# Navigate to project
cd "C:\Users\wo840\OneDrive\바탕 화면\sns\mobile-qa-automation\dashboard"

# Create deployment archive (exclude unnecessary files)
# Option 1: Use 7-Zip GUI
# - Right-click folder → 7-Zip → Add to archive
# - Archive format: tar.gz
# - Exclude: node_modules, .next, .git

# Option 2: PowerShell (if tar available)
tar --exclude=node_modules --exclude=.next --exclude=.git -czf dashboard.tar.gz .
```

### Step 3.2: Upload to Server

**Using WinSCP**:

1. Open WinSCP
2. Protocol: SFTP
3. Host: `123.45.67.89`
4. Username: `ubuntu`
5. Advanced → SSH → Authentication → Private key: `~\.ssh\oracle_cloud_key`
6. Login
7. Upload `dashboard.tar.gz` to `/home/ubuntu/`

**Using SCP (command line)**:

```powershell
scp -i ~\.ssh\oracle_cloud_key dashboard.tar.gz ubuntu@123.45.67.89:/home/ubuntu/
```

### Step 3.3: Extract and Install

**On the server (SSH)**:

```bash
# Extract archive
cd /home/ubuntu
tar -xzf dashboard.tar.gz -C dashboard
cd dashboard

# Install dependencies
npm install

# Set environment variables
cp .env.example .env
vim .env
```

**Edit `.env`**:
```bash
# Database
DATABASE_URL="your_postgresql_connection_string"

# API Keys
APIFY_API_TOKEN="your_apify_token"
YOUTUBE_API_KEY="your_youtube_api_key"

# Scraper settings
SCRAPER_DEBUG="false"
```

Save and exit (`:wq`).

### Step 3.4: Build Project

```bash
# Build Next.js for production
npm run build

# Test if build succeeded
ls -la .next/  # Should contain build artifacts
```

### Step 3.5: Start with PM2

```bash
# Start Next.js with PM2
pm2 start npm --name "sns-dashboard" -- start

# Verify status
pm2 status

# View logs
pm2 logs sns-dashboard

# Make PM2 start on boot
pm2 startup
# Copy and run the command it outputs (starts with sudo)

pm2 save
```

### Step 3.6: Test Dashboard Access

**From your local PC**:

Open browser: `http://123.45.67.89:3000`

You should see the dashboard.

---

## Phase 4: Browser Profile Setup

**Duration**: 10-15 minutes (local testing), 5 minutes (upload)

### Step 4.1: Create Profiles Locally (Windows PC)

```powershell
# Start Next.js locally
cd "C:\Users\wo840\OneDrive\바탕 화면\sns\mobile-qa-automation\dashboard"
npm run dev
```

**Login to Instagram**:

```powershell
# Open another PowerShell window
curl -X POST http://localhost:3000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"platform":"instagram","accountId":"acc_001"}'
```

- Browser opens automatically
- Login to Instagram manually
- Complete 2FA if required
- After successful login, close the API call:

```powershell
curl -X DELETE http://localhost:3000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"platform":"instagram","accountId":"acc_001"}'
```

**Login to Facebook** (repeat same process):

```powershell
curl -X POST http://localhost:3000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"platform":"facebook","accountId":"acc_001"}'

# Login manually...

curl -X DELETE http://localhost:3000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"platform":"facebook","accountId":"acc_001"}'
```

**Verify profiles created**:

```powershell
ls "C:\Users\wo840\.sns-dashboard-profiles\"
# Should show:
# - instagram\acc_001\
# - facebook\acc_001\
```

### Step 4.2: Update accounts.json

Edit `dashboard/accounts.json`:

```json
[
  {
    "id": "acc_001",
    "platform": "instagram",
    "username": "your_actual_instagram_username",
    "profileDir": "/home/ubuntu/.sns-dashboard-profiles/instagram/acc_001",
    "lastActivity": "2026-02-05T02:44:36.000Z"
  },
  {
    "id": "acc_001",
    "platform": "facebook",
    "username": "your_actual_facebook_username",
    "profileDir": "/home/ubuntu/.sns-dashboard-profiles/facebook/acc_001",
    "lastActivity": "2026-02-05T02:44:36.000Z"
  }
]
```

### Step 4.3: Upload Profiles to Server

**Compress profiles**:

```powershell
cd "C:\Users\wo840"
tar -czf profiles.tar.gz .sns-dashboard-profiles
```

**Upload to server**:

```powershell
scp -i ~\.ssh\oracle_cloud_key profiles.tar.gz ubuntu@123.45.67.89:/home/ubuntu/
```

**Extract on server**:

```bash
# SSH to server
ssh -i ~/.ssh/oracle_cloud_key ubuntu@123.45.67.89

# Extract profiles
cd /home/ubuntu
tar -xzf profiles.tar.gz

# Verify
ls -la .sns-dashboard-profiles/
# Should show instagram/acc_001/ and facebook/acc_001/
```

### Step 4.4: Upload Updated accounts.json

```powershell
scp -i ~\.ssh\oracle_cloud_key accounts.json ubuntu@123.45.67.89:/home/ubuntu/dashboard/
```

---

## Phase 5: Keep-Alive Automation

**Duration**: 10 minutes

### Step 5.1: Test Keep-Alive Script Manually

```bash
# SSH to server
cd /home/ubuntu/dashboard

# Run keep-alive script
node keep-alive.ts

# Expected output:
# ============================================================
# Processing: instagram - your_username (acc_001)
# ============================================================
# Launching browser with profile...
# Navigating to https://www.instagram.com/...
# [Instagram] Starting keep-alive activity...
# ...
# SUCCESS: Keep-alive completed for instagram - your_username
```

**If errors occur**:
- "Session expired" → Re-login locally and re-upload profile
- "Profile directory not found" → Check `accounts.json` paths
- Browser crashes → Install missing dependencies (see Troubleshooting)

### Step 5.2: Create Cron Job

```bash
# Edit crontab
crontab -e

# Choose editor (nano or vim)
# Add this line at the bottom:
0 */12 * * * cd /home/ubuntu/dashboard && /usr/bin/node keep-alive.ts >> /var/log/keep-alive.log 2>&1

# Save and exit
# - nano: Ctrl+X, Y, Enter
# - vim: Esc, :wq, Enter
```

**Cron schedule explanation**:
```
0 */12 * * *  → Every 12 hours at :00 minutes
│  │   │ │ │
│  │   │ │ └─ Day of week (any)
│  │   │ └─── Month (any)
│  │   └───── Day of month (any)
│  └───────── Hour (every 12 hours: 0, 12)
└─────────── Minute (0)
```

**Verify cron job**:

```bash
crontab -l
```

### Step 5.3: Create Log Rotation

```bash
# Create logrotate config
sudo vim /etc/logrotate.d/keep-alive

# Add this content:
/var/log/keep-alive.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
    create 0644 ubuntu ubuntu
}

# Save and exit
```

---

## Phase 6: Monitoring & Maintenance

### Monitor Logs

```bash
# View keep-alive logs (last 50 lines)
tail -n 50 /var/log/keep-alive.log

# Follow logs in real-time
tail -f /var/log/keep-alive.log

# View PM2 logs
pm2 logs sns-dashboard

# View system resources
htop
```

### Check Session Status

```bash
# View accounts.json
cat /home/ubuntu/dashboard/accounts.json

# Check last activity timestamps
```

### Manual Keep-Alive Trigger

```bash
cd /home/ubuntu/dashboard
node keep-alive.ts
```

### Restart Dashboard

```bash
pm2 restart sns-dashboard
pm2 logs sns-dashboard
```

### Update Code

```bash
# On local PC: create new archive
cd "C:\Users\wo840\OneDrive\바탕 화면\sns\mobile-qa-automation\dashboard"
tar --exclude=node_modules --exclude=.next --exclude=.git -czf dashboard-update.tar.gz .

# Upload to server
scp -i ~\.ssh\oracle_cloud_key dashboard-update.tar.gz ubuntu@123.45.67.89:/home/ubuntu/

# On server: extract and restart
cd /home/ubuntu/dashboard
tar -xzf ../dashboard-update.tar.gz
npm install
npm run build
pm2 restart sns-dashboard
```

---

## Troubleshooting

### Issue: Browser Crashes on Server

**Symptom**: `keep-alive.ts` fails with "Browser closed unexpectedly"

**Solution**: Install missing dependencies

```bash
sudo apt install -y \
  libgconf-2-4 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2
```

### Issue: Session Expired Message

**Symptom**: Keep-alive logs show "Session expired! Redirected to login page"

**Solution**: Re-create browser profiles

1. Login locally on your PC
2. Re-upload profiles to server
3. Verify paths in `accounts.json`

### Issue: Cron Job Not Running

**Symptom**: No logs in `/var/log/keep-alive.log`

**Solution**: Verify cron configuration

```bash
# Check cron service status
systemctl status cron

# View cron logs
grep CRON /var/log/syslog

# Verify crontab entry
crontab -l

# Test command manually
cd /home/ubuntu/dashboard && /usr/bin/node keep-alive.ts
```

### Issue: Port 3000 Not Accessible

**Symptom**: Cannot access `http://123.45.67.89:3000`

**Solution**: Check firewall rules

```bash
# Oracle Cloud Security List (web console)
# → Add ingress rule for port 3000

# Ubuntu firewall
sudo ufw status
sudo ufw allow 3000/tcp

# Verify Next.js is running
pm2 status
pm2 logs sns-dashboard
```

### Issue: Out of Memory

**Symptom**: Browser crashes with "Out of memory"

**Solution**: Increase swap space

```bash
# Check current swap
free -h

# Create larger swap (4GB)
sudo swapoff /swapfile
sudo dd if=/dev/zero of=/swapfile bs=1M count=4096
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Verify
free -h
```

### Issue: Accounts.json Not Found

**Symptom**: `keep-alive.ts` fails with "accounts.json not found"

**Solution**: Verify file location

```bash
# Check if file exists
ls -la /home/ubuntu/dashboard/accounts.json

# If missing, re-upload from local
# (On local PC)
scp -i ~\.ssh\oracle_cloud_key accounts.json ubuntu@123.45.67.89:/home/ubuntu/dashboard/
```

---

## Cost Verification

### Confirm Always Free Usage

1. Oracle Cloud Console → **Billing & Cost Management** → **Cost Analysis**
2. Filter by: **Compute**
3. Verify: **Estimated Monthly Cost: $0.00**

**Resources Used** (Always Free eligible):

| Resource | Limit | Usage | % Used |
|----------|-------|-------|--------|
| Ampere A1 Compute | 4 OCPU, 24GB RAM | 2 OCPU, 12GB RAM | 50% |
| Block Volume | 200GB | 50GB | 25% |
| Outbound Traffic | 10TB/month | ~1GB/month | 0.01% |

---

## Success Checklist

- [ ] Oracle Cloud VM created and running
- [ ] SSH access configured
- [ ] Node.js 20.x installed
- [ ] Chromium dependencies installed
- [ ] Dashboard deployed and accessible at `http://<IP>:3000`
- [ ] Browser profiles created locally
- [ ] Profiles uploaded to server
- [ ] `accounts.json` configured with correct paths
- [ ] `keep-alive.ts` runs successfully manually
- [ ] Cron job configured (every 12 hours)
- [ ] Logs showing successful keep-alive executions
- [ ] Session lifetime extended to 9-12+ months

---

## Expected Session Lifetime

| Method | Lifetime | Notes |
|--------|----------|-------|
| Cookie only (old) | 1-3 months | Expires naturally |
| User Data Directory | 3-6 months | Longer base lifetime |
| UDD + Keep-Alive (12h) | 9-12+ months | Simulates active user |
| UDD + Keep-Alive (6h) | 12-18 months | More frequent activity |

**Recommendation**: Keep 12-hour interval to balance session lifetime and detection risk.

---

## Security Notes

1. **SSH Key**: Never share `oracle_cloud_key` private key
2. **Environment Variables**: Keep `.env` file secure (contains API keys)
3. **Browser Profiles**: Contain login sessions - treat as passwords
4. **Firewall**: Only open necessary ports (22, 3000)
5. **Updates**: Run `sudo apt update && sudo apt upgrade` monthly

---

## Next Steps After Deployment

1. **Monitor for 1 week**: Check logs daily to ensure keep-alive runs successfully
2. **Verify session persistence**: After 1 month, check if sessions still active
3. **Adjust interval if needed**: If sessions expire, reduce cron interval to 6 hours
4. **Scale up**: Add more accounts by updating `accounts.json` and creating new profiles

---

## Support & Resources

- **Oracle Cloud Docs**: https://docs.oracle.com/en-us/iaas/
- **Oracle Cloud Free Tier**: https://www.oracle.com/cloud/free/
- **Puppeteer Troubleshooting**: https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md
- **PM2 Documentation**: https://pm2.keymetrics.io/docs/

---

**Deployment Guide Version**: 1.0  
**Last Updated**: 2026-02-05  
**Estimated Total Time**: 2-3 hours (including testing)
