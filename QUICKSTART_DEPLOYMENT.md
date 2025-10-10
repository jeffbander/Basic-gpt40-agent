# Quick Start: Deploy in 30 Minutes

This is the fastest path to get your Medical AI Calling System deployed to production.

## Prerequisites (5 minutes)

1. **Accounts Setup:**
   - [ ] GitHub account (push your code)
   - [ ] Firebase account (database)
   - [ ] Vercel account (hosting)

2. **Have Ready:**
   - [ ] Twilio Account SID, Auth Token, Phone Number
   - [ ] OpenAI API Key

## Step 1: Firebase Setup (10 minutes)

```bash
# Open Firebase Console
open https://console.firebase.google.com/
```

1. Create project → `medical-ai-calling`
2. Enable Firestore → Production mode → `us-east1`
3. Security Rules → Paste:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} { allow read, write: if false; }
     }
   }
   ```
4. Generate Service Account:
   - Settings ⚙️ → Service Accounts → Generate Key
   - Save as `firebase-service-account.json`

```bash
# Move to project
mv ~/Downloads/firebase-service-account.json ./call-management/database/
```

5. Update `.env`:
   ```bash
   echo "USE_FIRESTORE=true" >> .env
   echo "FIREBASE_SERVICE_ACCOUNT_PATH=./call-management/database/firebase-service-account.json" >> .env
   ```

## Step 2: Test Locally (5 minutes)

```bash
# Install dependencies
npm install

# Start server
npm run start:medical

# In another terminal - test
curl http://localhost:5051/health
# Should return: {"status":"healthy","database":"firestore",...}
```

## Step 3: Deploy to Vercel (10 minutes)

### Via Vercel Dashboard (Recommended)

```bash
# Commit your code
git add .
git commit -m "feat: Add deployment configuration"
git push origin main
```

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. **BEFORE deploying**, add Environment Variables:
   - `OPENAI_API_KEY` → Your OpenAI key
   - `TWILIO_ACCOUNT_SID` → Your Twilio SID
   - `TWILIO_AUTH_TOKEN` → Your Twilio token
   - `TWILIO_PHONE_NUMBER` → Your Twilio number
   - `USE_FIRESTORE` → `true`
   - `FIREBASE_SERVICE_ACCOUNT_JSON` → Copy entire contents of firebase-service-account.json:
     ```bash
     cat ./call-management/database/firebase-service-account.json | jq -c
     ```
   - `NODE_ENV` → `production`
4. Click "Deploy"
5. Wait 2-3 minutes
6. Copy your deployment URL (e.g., `https://your-app.vercel.app`)

### Or Via CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod

# Follow prompts, add environment variables when asked
```

## Step 4: Configure Twilio (5 minutes)

1. Go to [Twilio Console](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
2. Click your phone number
3. Under "Voice Configuration":
   - A CALL COMES IN: **Webhook**
   - URL: `https://your-vercel-url.vercel.app/incoming-call`
   - HTTP Method: **POST**
4. Save

## Step 5: Test Your Deployment (2 minutes)

```bash
# Call your Twilio number from your phone
# You should hear the AI assistant!

# Or test the health endpoint
curl https://your-vercel-url.vercel.app/health
```

## Step 6: Set Up CI/CD (Optional - 5 minutes)

Enable automatic deployments when you push to GitHub:

1. Get Vercel token:
   ```bash
   # Go to https://vercel.com/account/tokens
   # Create new token, copy it
   ```

2. Get Vercel IDs:
   ```bash
   cat .vercel/project.json
   # Copy orgId and projectId
   ```

3. Add GitHub Secrets:
   - Go to your repo → Settings → Secrets → Actions
   - Add:
     - `VERCEL_TOKEN` → Your Vercel token
     - `VERCEL_ORG_ID` → From .vercel/project.json
     - `VERCEL_PROJECT_ID` → From .vercel/project.json

4. Push to trigger deployment:
   ```bash
   git push origin main
   # GitHub Actions will automatically deploy!
   ```

## Troubleshooting

### "Firebase not initialized"
```bash
# Make sure FIREBASE_SERVICE_ACCOUNT_JSON is set in Vercel
# Verify the JSON is valid
cat firebase-service-account.json | jq .
```

### "Module not found: firebase-admin"
```bash
npm install firebase-admin
git add package.json package-lock.json
git commit -m "fix: Add firebase-admin dependency"
git push
```

### WebSocket connection fails
- Vercel has 60s timeout for serverless functions
- For long calls, consider Edge Functions or separate WebSocket server

### Deployment succeeds but calls fail
1. Check Vercel logs: `vercel logs --follow`
2. Verify environment variables are set
3. Check Twilio webhook URL is correct
4. Verify Firebase credentials are valid

## What's Next?

- [ ] Set up Firebase indexes (see FIREBASE_SETUP.md)
- [ ] Configure monitoring and alerts
- [ ] Set up staging environment
- [ ] Add custom domain in Vercel
- [ ] Review HIPAA compliance checklist

## Full Documentation

- **Firebase Setup:** [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)
- **Full Deployment:** [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Summary:** [DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md)

## Success Checklist

- [x] Code configured for Firebase + Vercel
- [ ] Firebase project created
- [ ] Firestore enabled and configured
- [ ] Service account key generated
- [ ] App tested locally with Firestore
- [ ] Deployed to Vercel
- [ ] Environment variables configured
- [ ] Twilio webhooks updated
- [ ] Test call successful
- [ ] CI/CD pipeline enabled

---

**Stuck?** Check the full [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed troubleshooting.

**Ready?** Start with Step 1 above!
