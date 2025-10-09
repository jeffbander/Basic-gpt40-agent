# Multi-App Ngrok Setup - System Documentation

**Created:** 2025-10-09
**Status:** ✅ PRODUCTION READY

This document describes the unified ngrok tunnel management system for multiple applications.

---

## 🎯 System Overview

Two applications share a centralized ngrok configuration with automatic URL synchronization:

### Applications:
1. **Medical Outbound Calling System** (Port 5051)
2. **HeartVoice Monitor Platform** (Port 3004 + 8080 WebSocket)

### Key Features:
- ✅ Single command starts all tunnels
- ✅ Automatic .env file updates for both apps
- ✅ Webhook info endpoints for external agents
- ✅ System environment variable override handling
- ✅ Next.js .env.local support

---

## 📂 Configuration Files

### 1. `ngrok-config.yml`
Central configuration for all ngrok tunnels:

```yaml
version: "2"
authtoken: 31wbk8kVUqHXH8umAHFOnOlR1Dg_3Cd2PSnnJZA5W9qY8FFtK
region: us

tunnels:
  medical-app:
    proto: http
    addr: 5051
    subdomain: ""
    inspect: true
    bind_tls: true

  heartvoice-monitor:
    proto: http
    addr: 3004
    subdomain: ""
    inspect: true
    bind_tls: true

  heartvoice-websocket:
    proto: http
    addr: 8080
    subdomain: ""
    inspect: true
    bind_tls: true
```

### 2. `update-all-ngrok-urls.js`
Automated URL updater that:
- Queries ngrok API (http://localhost:4040/api/tunnels)
- Finds HTTPS tunnels for each app by port
- Updates Medical App `.env` with `BASE_URL`
- Creates/updates HeartVoice `.env.local` with `NEXT_PUBLIC_BASE_URL` and `WEBSOCKET_PUBLIC_URL`

### 3. `start-ngrok.bat`
Batch script that starts all 3 tunnels simultaneously.

---

## 🚀 Usage

### Initial Setup (One Time)

1. **Kill existing processes:**
   ```bash
   taskkill /F /IM ngrok.exe
   taskkill /F /IM node.exe
   ```

2. **Start all ngrok tunnels:**
   ```bash
   cd C:\Users\jeffr\gpt40\Basic-gpt40-agent
   start-ngrok.bat
   ```

3. **Update all .env files:**
   ```bash
   npm run update:all-ngrok
   ```

4. **Start Medical App:**
   ```bash
   npm run start:medical
   ```

5. **Start HeartVoice (in separate terminal):**
   ```bash
   cd C:\Users\jeffr\Downloads\CHF-working\heartvoice-monitor
   npm run dev:all
   ```

### When Ngrok URLs Change

Simply run:
```bash
cd C:\Users\jeffr\gpt40\Basic-gpt40-agent
npm run update:all-ngrok
```

Then restart both applications.

---

## 🔧 Critical Fixes Applied

### Issue 1: System Environment Variable Override
**Problem:** System had `BASE_URL=https://f0db47054b2c.ngrok.app` (old ngrok URL) in environment variables, overriding the .env file.

**Solution:** Modified `outbound-medical-v2.js:16`:
```javascript
// Before:
dotenv.config();

// After:
dotenv.config({ path: path.join(__dirname, '.env'), override: true });
```

This forces .env file values to take priority over system environment variables.

### Issue 2: sqlite3 Binary Incompatibility
**Problem:** sqlite3 native module was compiled for different platform/Node version.

**Solution:**
```bash
rm -rf node_modules
npm install
```
This rebuilt all native modules for Windows + Node v22.20.0.

### Issue 3: Corrupted .bashrc
**Problem:** .bashrc had UTF-16 encoding with BOM causing bash errors.

**Solution:** Recreated .bashrc with proper UTF-8 encoding and added Node.js to PATH.

### Issue 4: package.json Missing ES Module Support
**Problem:** Code uses ES6 imports but package.json lacked module type.

**Solution:** Added `"type": "module"` to package.json.

---

## 📊 Application Details

### Medical Outbound Calling System

**Location:** `C:\Users\jeffr\gpt40\Basic-gpt40-agent`

**Configuration:**
- Port: 5051
- Env File: `.env`
- Env Variable: `BASE_URL`
- Server: Fastify
- Module Type: ES6

**Webhook Endpoints:**
- `/api/webhook/agent-trigger` - External agents trigger calls
- `/api/webhook-info` - Query current ngrok URLs
- `/call-status` - Twilio status callbacks
- `/recording-status` - Recording status updates

**Environment Variables:**
```bash
BASE_URL=https://[ngrok-url].ngrok.app
PORT=5051
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
OPENAI_API_KEY=...
```

**Startup Log Check:**
```
========================================
ENVIRONMENT VARIABLES LOADED FROM: C:\Users\jeffr\gpt40\Basic-gpt40-agent\.env
BASE_URL: https://af3784abe05e.ngrok.app
PORT: 5051
========================================
```

### HeartVoice Monitor Platform

**Location:** `C:\Users\jeffr\Downloads\CHF-working\heartvoice-monitor`

**Configuration:**
- Main Port: 3004 (Next.js)
- WebSocket Port: 8080
- Env File: `.env.local` (created by updater)
- Env Variables: `NEXT_PUBLIC_BASE_URL`, `WEBSOCKET_PUBLIC_URL`
- Framework: Next.js 15.5.3 + React 19

**Webhook Endpoints:**
- `/api/voice-twiml` - Twilio voice handler
- `/api/voice-webhook` - Primary webhook
- `/api/voice-webhook/symptoms` - Symptom assessment
- `/api/voice-webhook/energy` - Energy assessment
- `/api/voice-webhook/completion` - Call completion
- `/api/twilio-status` - Status callbacks
- `/api/webhook/agent-trigger` - Agent triggers
- `/api/webhook-info` - Query current URLs
- `/api/voice-stream` - WebSocket upgrade

**Environment Priority (Next.js):**
1. `.env.local` (highest - used by updater)
2. `.env.development`
3. `.env`

---

## 🌐 External Agent Integration

### Querying Current URLs

Both apps provide a `/api/webhook-info` endpoint:

```bash
# Medical App
curl http://localhost:5051/api/webhook-info

# HeartVoice
curl http://localhost:3004/api/webhook-info
```

**Response Format:**
```json
{
  "timestamp": "2025-10-09T...",
  "baseUrl": "https://[ngrok-url].ngrok.app",
  "webhookEndpoints": {
    "agentTrigger": "https://[ngrok-url].ngrok.app/api/webhook/agent-trigger",
    "callStatus": "https://[ngrok-url].ngrok.app/call-status",
    ...
  },
  "payloadExample": {...},
  "supportedFields": {...},
  "notes": [...]
}
```

### Agent Polling Strategy

External agents can poll this endpoint to detect URL changes:

```javascript
let currentUrl = '';

async function checkWebhookUrl() {
  const response = await fetch('http://localhost:5051/api/webhook-info');
  const data = await response.json();
  const newUrl = data.webhookEndpoints.agentTrigger;

  if (newUrl !== currentUrl) {
    console.log('Webhook URL changed:', newUrl);
    currentUrl = newUrl;
    // Update agent configuration
  }
}

// Poll every 5 minutes
setInterval(checkWebhookUrl, 5 * 60 * 1000);
```

---

## 🔍 Troubleshooting

### Ngrok Won't Start

**Symptom:** Error about simultaneous sessions or authentication failed.

**Causes:**
- Another ngrok instance running
- Free account (limited to 1 tunnel)
- Invalid auth token

**Solutions:**
```bash
# Check for running ngrok
tasklist | findstr ngrok

# Kill all ngrok processes
taskkill /F /IM ngrok.exe

# Verify auth token in ngrok-config.yml
# Make sure you have ngrok Pro account for multiple tunnels
```

### URLs Not Updating

**Symptom:** Old ngrok URLs still in use after running updater.

**Causes:**
- Ngrok not running when updater ran
- System environment variables overriding
- Server not restarted

**Solutions:**
```bash
# 1. Verify ngrok is running
curl http://localhost:4040/api/tunnels

# 2. Run updater
npm run update:all-ngrok

# 3. Check .env files were modified
cat .env | grep BASE_URL
cat ../CHF-working/heartvoice-monitor/.env.local | grep NEXT_PUBLIC_BASE_URL

# 4. Restart both servers

# 5. Verify logs show correct URL
# Medical App should log: BASE_URL: https://[new-url].ngrok.app
```

### Application Error on Twilio Calls

**Symptom:** Hear "an application error has occurred" when receiving calls.

**Root Cause:** Twilio hitting old/offline ngrok URL.

**Debug Steps:**
```bash
# 1. Get call SID from logs or Twilio console

# 2. Query Twilio API for call events
curl -X GET "https://api.twilio.com/2010-04-01/Accounts/[ACCOUNT_SID]/Calls/[CALL_SID]/Events.json" \
  -u "ACCOUNT_SID:AUTH_TOKEN"

# 3. Check response_body for ngrok errors (ERR_NGROK_3200 = offline)

# 4. Verify current BASE_URL matches active ngrok tunnel
curl http://localhost:4040/api/tunnels | grep public_url

# 5. Update and restart
npm run update:all-ngrok
npm run start:medical
```

### Server Using Old URL After Update

**Symptom:** Server logs show old BASE_URL despite .env being updated.

**Cause:** dotenv doesn't reload after initial load.

**Solution:**
```bash
# Must restart server after .env changes
# dotenv loads once at startup

# Kill and restart
taskkill /F /IM node.exe
npm run start:medical

# Verify from startup logs:
# BASE_URL: https://[correct-url].ngrok.app
```

---

## 📝 NPM Scripts

### Medical App (`package.json`)

```json
{
  "scripts": {
    "start:medical": "node outbound-medical-v2.js",
    "update:ngrok": "node update-ngrok-urls.js",
    "update:all-ngrok": "node update-all-ngrok-urls.js"
  }
}
```

**Usage:**
- `npm run start:medical` - Start Medical App server
- `npm run update:ngrok` - Update only Medical App .env
- `npm run update:all-ngrok` - Update both apps (recommended)

---

## 🔐 Security Notes

### Sensitive Information

The following files contain sensitive data and should NEVER be committed:
- `.env` (API keys, auth tokens)
- `.env.local` (auto-generated with ngrok URLs)
- `ngrok-config.yml` (contains auth token)

### HIPAA Compliance (HeartVoice)

HeartVoice handles Protected Health Information (PHI):
- All webhooks MUST use HTTPS (ngrok tunnels are HTTPS by default)
- Sensitive API keys in .env files
- Call recordings contain patient data
- Transcripts contain medical information

---

## 📚 Additional Documentation

- `README-NGROK-SETUP.md` - Detailed setup guide
- `MULTI_APP_SETUP_COMPLETE.md` - Complete system overview
- `RESPONSE_TO_OTHER_CLAUDE.md` - Instructions for HeartVoice Claude instance
- `INSTRUCTIONS_FOR_OTHER_CLAUDE.md` - Template for integrating new apps

---

## 🎯 Quick Reference

### Start Everything Fresh

```bash
# 1. Clean slate
taskkill /F /IM ngrok.exe
taskkill /F /IM node.exe

# 2. Start ngrok (all tunnels)
cd C:\Users\jeffr\gpt40\Basic-gpt40-agent
start-ngrok.bat

# 3. Update URLs (both apps)
npm run update:all-ngrok

# 4. Start Medical App
npm run start:medical

# 5. Start HeartVoice (new terminal)
cd C:\Users\jeffr\Downloads\CHF-working\heartvoice-monitor
npm run dev:all
```

### Verify Everything Works

```bash
# Check ngrok tunnels
curl http://localhost:4040/api/tunnels

# Check Medical App
curl http://localhost:5051/api/webhook-info

# Check HeartVoice
curl http://localhost:3004/api/webhook-info
```

### When Ngrok Restarts

```bash
npm run update:all-ngrok
# Then restart both apps
```

---

## 🚨 Emergency Recovery

If everything breaks:

1. **Kill all processes:**
   ```bash
   taskkill /F /IM ngrok.exe
   taskkill /F /IM node.exe
   ```

2. **Remove system env var override:**
   ```bash
   # In bash
   unset BASE_URL
   ```

3. **Fresh npm install (Medical App):**
   ```bash
   cd C:\Users\jeffr\gpt40\Basic-gpt40-agent
   rm -rf node_modules
   npm install
   ```

4. **Delete auto-generated files:**
   ```bash
   rm .env.local  # If exists
   rm C:\Users\jeffr\Downloads\CHF-working\heartvoice-monitor\.env.local
   ```

5. **Start fresh from "Start Everything Fresh" above**

---

## 📞 Contact & Support

- Medical App Issues: Check server logs in terminal
- HeartVoice Issues: Check Next.js dev server logs
- Ngrok Issues: Check http://localhost:4040 (ngrok dashboard)
- Twilio Issues: Check https://console.twilio.com/monitor/logs/calls

---

**Last Updated:** 2025-10-09
**Maintained By:** Claude Code Multi-Agent System
**Status:** Production Ready ✅
