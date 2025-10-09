# Instructions for Other App's Claude Code Instance

Hey Claude! I'm coordinating multi-app ngrok tunnels. Here's what I need you to do:

## 🎯 Your Tasks:

### 1. Identify Your App's Port
Find what port your application runs on. Check:
- Server startup logs
- Environment variables (PORT, SERVER_PORT, etc.)
- Config files (package.json scripts, .env, etc.)
- Main server file (express.listen, fastify.listen, etc.)

**Return this:**
```
PORT: <your_port_number>
APP_NAME: <descriptive_name_like_"frontend-app">
```

### 2. Check If Your App Needs External Webhooks
Does your app:
- Receive webhooks from external services?
- Need a public URL to function?
- Have any URLs hardcoded that need updating?

**Return this:**
```
NEEDS_PUBLIC_URL: yes/no
WEBHOOK_ENDPOINTS: <list any webhook endpoints like "/api/webhook", "/callback", etc.>
```

### 3. Find Your Environment Config
Locate where your app stores the base URL/webhook URL:
- .env file?
- config.js?
- Hardcoded in code?

**Return this:**
```
ENV_FILE_PATH: <full path to .env or config file>
ENV_VARIABLE_NAME: <name like "BASE_URL", "WEBHOOK_URL", "PUBLIC_URL", etc.>
CURRENT_VALUE: <current value if any>
```

### 4. Add API Endpoint (Optional but Recommended)
If your app can, add this endpoint so external services can query your current ngrok URL:

```javascript
// Express example:
app.get('/api/webhook-info', (req, res) => {
  const baseUrl = process.env.BASE_URL || process.env.YOUR_ENV_VAR || 'http://localhost:YOUR_PORT';
  res.json({
    timestamp: new Date().toISOString(),
    baseUrl: baseUrl,
    webhookEndpoints: {
      // List your webhook endpoints here
      yourWebhook: `${baseUrl}/your-webhook-path`
    }
  });
});

// Fastify example:
fastify.get('/api/webhook-info', async (request, reply) => {
  const baseUrl = process.env.BASE_URL || process.env.YOUR_ENV_VAR || 'http://localhost:YOUR_PORT';
  reply.send({
    timestamp: new Date().toISOString(),
    baseUrl: baseUrl,
    webhookEndpoints: {
      yourWebhook: `${baseUrl}/your-webhook-path`
    }
  });
});
```

**Return this:**
```
ENDPOINT_ADDED: yes/no
ENDPOINT_PATH: /api/webhook-info (or your chosen path)
```

### 5. Add .env Override (If Using dotenv)
If you use dotenv, add this to force .env file priority over system variables:

```javascript
// At the top of your main file, change:
// dotenv.config();

// To:
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env'), override: true });
```

**Return this:**
```
DOTENV_OVERRIDE_ADDED: yes/no
```

## 📤 Full Response Format

Please return this complete information:

```
=== APP INFORMATION ===
PORT: <port>
APP_NAME: <name>
NEEDS_PUBLIC_URL: <yes/no>
WEBHOOK_ENDPOINTS: <list>

=== CONFIGURATION ===
ENV_FILE_PATH: <path>
ENV_VARIABLE_NAME: <variable>
CURRENT_VALUE: <value>

=== UPDATES MADE ===
ENDPOINT_ADDED: <yes/no>
ENDPOINT_PATH: <path>
DOTENV_OVERRIDE_ADDED: <yes/no>

=== ADDITIONAL NOTES ===
<Any other relevant information, dependencies, special requirements, etc.>
```

## 🚀 What Happens Next:

Once you return this info, the other Claude instance will:
1. Update the shared ngrok-config.yml with your app
2. Create a startup script for multi-app ngrok tunnels
3. Configure automatic URL updating for both apps
4. Coordinate tunnel management between both apps

## ⚠️ Important:

- Make sure your app's server is stopped before making changes
- Test that the endpoint works after adding it
- Don't commit sensitive data (API keys, etc.) in the response

---

**Ready? Start with Task 1: Identify Your App's Port!**
