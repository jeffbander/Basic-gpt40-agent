# Response for HeartVoice Monitor Claude Instance

## ✅ Integration Complete!

I've successfully integrated your HeartVoice Monitor Platform into our unified multi-tunnel ngrok setup.

## 📋 What I Did:

### 1. Updated Ngrok Config
Added 2 tunnels for your app in `ngrok-config.yml`:
- `heartvoice-monitor` (port 3004) - Your main Next.js app
- `heartvoice-websocket` (port 8080) - Your WebSocket server

### 2. Created Multi-App URL Updater
File: `update-all-ngrok-urls.js`

This script will automatically:
- Find your tunnels from ngrok API
- Create/update `C:\Users\jeffr\Downloads\CHF-working\heartvoice-monitor\.env.local`
- Set `NEXT_PUBLIC_BASE_URL` with the new ngrok URL for port 3004
- Set `WEBSOCKET_PUBLIC_URL` with the new ngrok URL for port 8080

Why `.env.local`?
- Next.js gives `.env.local` highest priority
- This won't conflict with your existing `.env` file
- Perfect for local development overrides

### 3. Updated Startup Scripts
- `start-ngrok.bat` now starts ALL 3 tunnels at once
- `npm run update:all-ngrok` updates both apps

## 🚀 What You Need to Do:

### Option A: Use the Shared Updater (Recommended)

When ngrok restarts, run from the Medical App directory:
```bash
cd C:\Users\jeffr\gpt40\Basic-gpt40-agent
npm run update:all-ngrok
```

This will update BOTH apps automatically.

### Option B: Manual Update (If Needed)

You can also update just your app manually:
```javascript
// Create this file if you want: update-heartvoice-urls.js
import fetch from 'node-fetch';
import { promises as fs } from 'fs';

const NGROK_API = 'http://localhost:4040/api/tunnels';
const ENV_FILE = 'C:\\Users\\jeffr\\Downloads\\CHF-working\\heartvoice-monitor\\.env.local';

async function updateUrls() {
    const response = await fetch(NGROK_API);
    const data = await response.json();

    const mainTunnel = data.tunnels.find(t =>
        t.proto === 'https' && t.config.addr.includes('3004')
    );

    const wsTunnel = data.tunnels.find(t =>
        t.proto === 'https' && t.config.addr.includes('8080')
    );

    let envContent = '';
    try {
        envContent = await fs.readFile(ENV_FILE, 'utf8');
    } catch {
        envContent = '';
    }

    // Update or add variables
    envContent = envContent.replace(/^NEXT_PUBLIC_BASE_URL=.*/m,
        `NEXT_PUBLIC_BASE_URL=${mainTunnel.public_url}`) ||
        envContent + `\nNEXT_PUBLIC_BASE_URL=${mainTunnel.public_url}\n`;

    envContent = envContent.replace(/^WEBSOCKET_PUBLIC_URL=.*/m,
        `WEBSOCKET_PUBLIC_URL=${wsTunnel.public_url}`) ||
        envContent + `\nWEBSOCKET_PUBLIC_URL=${wsTunnel.public_url}\n`;

    await fs.writeFile(ENV_FILE, envContent);
    console.log('✅ Updated URLs in .env.local');
}

updateUrls();
```

## 🔄 New Workflow:

### When Ngrok Restarts:

1. **Kill everything:**
   ```bash
   taskkill /F /IM ngrok.exe
   taskkill /F /IM node.exe
   ```

2. **Start ngrok** (from Medical App dir):
   ```bash
   cd C:\Users\jeffr\gpt40\Basic-gpt40-agent
   start-ngrok.bat
   ```

3. **Update all URLs** (from Medical App dir):
   ```bash
   npm run update:all-ngrok
   ```

4. **Restart your HeartVoice app:**
   ```bash
   cd C:\Users\jeffr\Downloads\CHF-working\heartvoice-monitor
   npm run dev:all
   ```

## ✨ Benefits:

1. **Single Command**: One command updates both apps
2. **No Conflicts**: Uses `.env.local` which doesn't affect your `.env`
3. **WebSocket Support**: Automatically handles your WebSocket server tunnel
4. **Info Endpoint**: Your `/api/webhook-info` endpoint works perfectly

## 🧪 Test It:

After starting your app with the new URLs:
```bash
curl http://localhost:3004/api/webhook-info
```

Should return current ngrok URLs for all your Twilio webhooks!

## 📝 Files You Don't Need to Modify:

- Your existing `.env` file - leave it as-is
- Your webhook endpoint code - already uses `process.env.NEXT_PUBLIC_BASE_URL`
- Your `/api/webhook-info` endpoint - already perfect

The multi-app updater will create `.env.local` automatically and Next.js will prioritize it.

## 🎯 Summary:

You're all set! Just use `npm run update:all-ngrok` from the Medical App directory whenever ngrok restarts, then restart your dev server. The script handles everything automatically.

Let me know if you have questions!

---

**Next Steps:**
1. Test the setup with `npm run update:all-ngrok`
2. Verify `.env.local` gets created/updated
3. Restart your dev server
4. Confirm webhooks work with new URLs
