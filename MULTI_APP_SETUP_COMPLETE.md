# ✅ Multi-App Ngrok Setup - COMPLETE

Both applications are now integrated into a unified ngrok tunnel management system!

## 🎯 What's Been Configured:

### 1. **Medical Outbound Calling System** (Port 5051)
- ✅ Tunnel name: `medical-app`
- ✅ Env variable: `BASE_URL` in `.env`
- ✅ Webhook endpoint: `/api/webhook/agent-trigger`
- ✅ Info endpoint: `/api/webhook-info`

### 2. **HeartVoice Monitor Platform** (Port 3004)
- ✅ Tunnel name: `heartvoice-monitor`
- ✅ Env variable: `NEXT_PUBLIC_BASE_URL` in `.env.local`
- ✅ Multiple Twilio webhook endpoints
- ✅ Info endpoint: `/api/webhook-info` (added by other Claude)

### 3. **HeartVoice WebSocket Server** (Port 8080)
- ✅ Tunnel name: `heartvoice-websocket`
- ✅ Env variable: `WEBSOCKET_PUBLIC_URL` in `.env.local`
- ✅ Handles Twilio Media Streams

## 📂 Files Created:

1. **ngrok-config.yml** - Configuration for all 3 tunnels
2. **update-all-ngrok-urls.js** - Updates both apps automatically
3. **start-ngrok.bat** - Starts all tunnels at once
4. **README-NGROK-SETUP.md** - Detailed documentation

## 🚀 Quick Start Guide:

### Step 1: Kill Everything
```bash
# Kill old ngrok
taskkill /F /IM ngrok.exe

# Kill Node processes
taskkill /F /IM node.exe
```

### Step 2: Start Ngrok (All Tunnels)
```bash
cd C:\Users\jeffr\gpt40\Basic-gpt40-agent
start-ngrok.bat
```

### Step 3: Update All .env Files
```bash
# In Medical App directory:
cd C:\Users\jeffr\gpt40\Basic-gpt40-agent
npm run update:all-ngrok
```

### Step 4: Restart Both Apps

**Terminal 1 - Medical App:**
```bash
cd C:\Users\jeffr\gpt40\Basic-gpt40-agent
npm run start:medical
```

**Terminal 2 - HeartVoice Monitor:**
```bash
cd C:\Users\jeffr\Downloads\CHF-working\heartvoice-monitor
npm run dev:all
```

## 🔄 When Ngrok URLs Change:

Simply run:
```bash
cd C:\Users\jeffr\gpt40\Basic-gpt40-agent
npm run update:all-ngrok
```

Then restart both apps. The script will:
- Fetch all current ngrok tunnels
- Update Medical App `.env` with new `BASE_URL`
- Create/update HeartVoice `.env.local` with new `NEXT_PUBLIC_BASE_URL`
- Update HeartVoice WebSocket URL

## 🌐 Verify Webhooks:

After starting both apps:

```bash
# Medical App
curl http://localhost:5051/api/webhook-info

# HeartVoice Monitor
curl http://localhost:3004/api/webhook-info
```

## 📊 Ngrok Dashboard:

View all active tunnels:
- **Web UI**: http://localhost:4040
- **API**: http://localhost:4040/api/tunnels

## 🔧 Troubleshooting:

### Ngrok won't start?
- Check auth token in `ngrok-config.yml`
- Make sure ports aren't already in use
- Verify you have ngrok Pro account (free accounts limit to 1 tunnel)

### URLs not updating?
- Make sure ngrok is running first
- Check that `npm run update:all-ngrok` completes without errors
- Verify `.env` and `.env.local` files were actually modified

### Apps still using old URLs?
- Restart both servers after running update script
- Check server startup logs show correct BASE_URL
- For HeartVoice: Make sure `.env.local` exists (overrides `.env`)

## 💡 Pro Tips:

1. **Agent Integration**: External agents should query the `/api/webhook-info` endpoints to get current URLs

2. **Automatic Updates**: You could set up a cron job or file watcher to run `npm run update:all-ngrok` and restart servers whenever ngrok changes

3. **Environment Priority**:
   - Medical App: `.env` (with override: true)
   - HeartVoice: `.env.local` > `.env.development` > `.env`

4. **Multiple Tunnels**: With ngrok Pro, you can add more apps by editing `ngrok-config.yml` and updating `update-all-ngrok-urls.js`

## 📝 Current Tunnel Configuration:

```yaml
tunnels:
  medical-app:
    proto: http
    addr: 5051

  heartvoice-monitor:
    proto: http
    addr: 3004

  heartvoice-websocket:
    proto: http
    addr: 8080
```

All tunnels use HTTPS and have inspection enabled!

---

## 🎉 You're All Set!

Both applications now share a unified ngrok management system. When ngrok restarts:
1. Run `npm run update:all-ngrok`
2. Restart both apps
3. External agents query `/api/webhook-info` for new URLs

Questions? Check `README-NGROK-SETUP.md` for more details!
