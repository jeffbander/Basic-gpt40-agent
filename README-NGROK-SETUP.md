# Ngrok Multi-Tunnel Setup Guide

This project now supports managing multiple ngrok tunnels with automatic URL configuration updates.

## 🚀 Quick Start

### 1. Start ngrok tunnels

```bash
# Option A: Use the batch script (Windows)
start-ngrok.bat

# Option B: Manual command
ngrok start medical-app --config=ngrok-config.yml
```

### 2. Update configuration

After ngrok starts, run the URL updater:

```bash
npm run update:ngrok
```

This will:
- Fetch current ngrok tunnel URLs
- Update `.env` with the new BASE_URL
- Display the webhook endpoint URL

### 3. Restart your server

```bash
npm run start:medical
```

## 📋 Files Created

### 1. `ngrok-config.yml`
Central configuration for all your ngrok tunnels. Edit this file to add more apps:

```yaml
tunnels:
  medical-app:
    proto: http
    addr: 5051

  # Add your other apps:
  my-other-app:
    proto: http
    addr: 3000
```

### 2. `update-ngrok-urls.js`
Utility script that:
- Queries ngrok API (localhost:4040)
- Finds the correct tunnel
- Updates `.env` with new BASE_URL

### 3. `start-ngrok.bat`
Windows batch script to start ngrok with your config file.

## 🔄 Workflow

### When ngrok restarts (URLs change):

1. **Stop everything**:
   ```bash
   # Kill ngrok
   taskkill /F /IM ngrok.exe

   # Kill Node
   taskkill /F /IM node.exe
   ```

2. **Start ngrok**:
   ```bash
   start-ngrok.bat
   ```

3. **Update config**:
   ```bash
   npm run update:ngrok
   ```

4. **Restart server**:
   ```bash
   npm run start:medical
   ```

### For External Agents:

Your agents should query this endpoint to get current webhook URLs:

```bash
GET http://localhost:5051/api/webhook-info
```

Response:
```json
{
  "baseUrl": "https://af3784abe05e.ngrok.app",
  "webhookEndpoints": {
    "agentTrigger": "https://af3784abe05e.ngrok.app/api/webhook/agent-trigger",
    "callStatus": "https://af3784abe05e.ngrok.app/call-status",
    ...
  },
  "payloadExample": { ... },
  "supportedFields": { ... }
}
```

## 🎯 Benefits

1. **Multiple Tunnels**: Run multiple apps with ngrok Pro
2. **Auto-Update**: Script updates `.env` automatically
3. **Agent-Friendly**: Agents can query `/api/webhook-info` for current URLs
4. **Centralized Config**: One `ngrok-config.yml` for all tunnels

## 💡 Pro Tips

### Add more tunnels:

Edit `ngrok-config.yml`:
```yaml
tunnels:
  medical-app:
    proto: http
    addr: 5051

  frontend-app:
    proto: http
    addr: 3000

  api-server:
    proto: http
    addr: 8080
```

Then start all at once:
```bash
ngrok start medical-app frontend-app api-server --config=ngrok-config.yml
```

### Automate with agents:

Have your external agents poll `/api/webhook-info` every 5 minutes to detect URL changes:

```javascript
async function getWebhookUrl() {
  const response = await fetch('http://localhost:5051/api/webhook-info');
  const data = await response.json();
  return data.webhookEndpoints.agentTrigger;
}

// Poll every 5 minutes
setInterval(async () => {
  const newUrl = await getWebhookUrl();
  if (newUrl !== currentUrl) {
    console.log('Webhook URL changed:', newUrl);
    currentUrl = newUrl;
  }
}, 5 * 60 * 1000);
```

## 🐛 Troubleshooting

### ngrok not starting?
- Check your auth token in `ngrok-config.yml`
- Verify ports aren't already in use: `netstat -ano | findstr :5051`

### .env not updating?
- Make sure ngrok is running: `curl http://localhost:4040/api/tunnels`
- Check that the updater found the right tunnel

### Server using old URL?
- Restart the server after running `npm run update:ngrok`
- Check that `.env` file was actually modified
- Verify the server logs show the correct BASE_URL on startup
