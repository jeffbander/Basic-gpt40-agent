# Browser Extension Deployment Guide

**Paste this entire file into your Claude Code browser extension to get guided step-by-step deployment assistance.**

---

# DEPLOYMENT TASK: Deploy Medical AI Calling System to Firebase + Vercel

## Context
I have a Medical AI Calling System (Twilio + OpenAI Realtime API) that needs to be deployed to production. The codebase is ready with:
- Firebase/Firestore integration configured
- Vercel deployment configuration ready
- GitHub Actions CI/CD pipeline configured
- All necessary adapters and documentation created

## Current GitHub Repository
- **Repository:** The current repo I'm working in (check the git remote)
- **Branch:** NGROK-working (will merge to main for deployment)
- **Local Path:** C:\Users\jeffr\gpt40\Basic-gpt40-agent

## Task Breakdown

Please guide me through the following steps **one at a time**, waiting for my approval before proceeding to the next step:

---

## STEP 1: Firebase Project Setup

### 1.1 Create Firebase Project
- Navigate to: https://console.firebase.google.com/
- Click "Add project" or "Create a project"
- **Project name:** `medical-ai-calling-system` (or suggest a better name)
- **Analytics:** Disable (or enable if I want it)
- Wait for project creation to complete

**WAIT FOR MY CONFIRMATION** before proceeding.

### 1.2 Enable Firestore Database
- In the Firebase Console, find "Firestore Database" in left sidebar
- Click "Create database"
- **Mode:** Start in production mode
- **Location:** Suggest closest to me (I'm in US) - probably `us-east1` or `us-central1`
- Click "Enable"
- Wait for database creation (1-2 minutes)

**WAIT FOR MY CONFIRMATION** that database is created.

### 1.3 Configure Firestore Security Rules
- In Firestore Database, go to "Rules" tab
- Replace existing rules with:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```
- Click "Publish"
- **Purpose:** This denies all client access; only our server (Firebase Admin SDK) can access data

**WAIT FOR MY CONFIRMATION** that rules are published.

### 1.4 Create Firestore Indexes
- Go to "Indexes" tab in Firestore
- Click "Add index" and create these 3 indexes:

**Index 1:**
- Collection ID: `webhook_queue`
- Fields to index:
  - `status` - Ascending
  - `scheduled_time` - Ascending
- Query scopes: Collection
- Click "Create"

**Index 2:**
- Collection ID: `webhook_queue`
- Fields to index:
  - `phone_number` - Ascending
  - `created_at` - Descending
- Query scopes: Collection
- Click "Create"

**Index 3:**
- Collection ID: `audit_log`
- Fields to index:
  - `event_type` - Ascending
  - `created_at` - Descending
- Query scopes: Collection
- Click "Create"

**Note:** Indexes may take 5-10 minutes to build. We can continue while they build.

**WAIT FOR MY CONFIRMATION** that all 3 indexes are created.

### 1.5 Generate Service Account Key
- Click the gear icon ⚙️ in Firebase Console (top left)
- Click "Project settings"
- Go to "Service accounts" tab
- Click "Generate new private key"
- Click "Generate key" (this will download a JSON file)
- **IMPORTANT:** I need to:
  - Rename the downloaded file to: `firebase-service-account.json`
  - Move it to: `C:\Users\jeffr\gpt40\Basic-gpt40-agent\call-management\database\`
  - **NEVER commit this file to Git** (already in .gitignore)

**CRITICAL:** After I download the file, I also need to:
- Open the file in a text editor
- Copy the ENTIRE JSON contents (minified, all on one line)
- Save it somewhere safe - I'll need it for Vercel environment variables

**WAIT FOR MY CONFIRMATION** that:
1. File is downloaded
2. File is renamed to `firebase-service-account.json`
3. File is moved to `call-management/database/` directory
4. JSON contents are copied and saved for later

### 1.6 Update Local .env File
Help me update my `.env` file with:
```bash
USE_FIRESTORE=true
FIREBASE_SERVICE_ACCOUNT_PATH=./call-management/database/firebase-service-account.json
```

**WAIT FOR MY CONFIRMATION** that .env is updated.

---

## STEP 2: Test Locally with Firestore

### 2.1 Verify Dependencies
- Make sure `firebase-admin` is installed (should already be done)
- If needed, run: `npm install`

**WAIT FOR MY CONFIRMATION**.

### 2.2 Start Local Server
- Run: `npm run start:medical`
- Server should start on port 5051

**WAIT FOR MY CONFIRMATION** that server is running.

### 2.3 Test Health Endpoint
- Open new terminal
- Run: `curl http://localhost:5051/health`
- Expected response should include:
  - `"status": "healthy"`
  - `"database": "firestore"`

**WAIT FOR MY CONFIRMATION** that health check passes.

### 2.4 Verify Firestore Connection
- Go to Firebase Console → Firestore Database → Data tab
- Check if `call_rules` collection exists with a default document
- This confirms our app successfully connected to Firestore

**WAIT FOR MY CONFIRMATION** that Firestore has data.

---

## STEP 3: Prepare GitHub Repository

### 3.1 Check Current Branch
- I'm currently on branch: `NGROK-working`
- I need to decide: merge to `main` or deploy from current branch?
- **Recommendation:** Merge to `main` for production deployment

**WAIT FOR MY DECISION** on branching strategy.

### 3.2 Commit Deployment Configuration
If not already committed, help me commit these new files:
- `.github/workflows/deploy.yml`
- `call-management/database/firestore-connection.js`
- `call-management/database/db-adapter.js`
- `vercel.json`
- `.vercelignore`
- Updated `.env.example`
- Updated `.gitignore`
- Documentation files

**Git commands:**
```bash
git add .github/ call-management/database/firestore-connection.js call-management/database/db-adapter.js vercel.json .vercelignore .env.example .gitignore *.md
git commit -m "feat: Add Firebase/Vercel deployment configuration with CI/CD"
```

**WAIT FOR MY CONFIRMATION** that files are committed.

### 3.3 Merge to Main (if applicable)
If I'm deploying from `main`:
```bash
git checkout main
git merge NGROK-working
git push origin main
```

**WAIT FOR MY CONFIRMATION** that code is pushed to GitHub.

---

## STEP 4: Vercel Setup

### 4.1 Create Vercel Account / Login
- Navigate to: https://vercel.com/signup
- Sign up or log in (I can use GitHub login for easy integration)

**WAIT FOR MY CONFIRMATION** that I'm logged in.

### 4.2 Import GitHub Repository
- Click "Add New..." → "Project"
- Click "Import" next to my repository (search for it if needed)
- **Repository:** The one I just pushed to
- Click "Import"

**WAIT FOR MY CONFIRMATION** that repository is imported.

### 4.3 Configure Project Settings
**DO NOT DEPLOY YET!** First configure:

- **Framework Preset:** Other
- **Root Directory:** `./` (leave as default)
- **Build Command:** Leave empty
- **Output Directory:** Leave empty
- **Install Command:** `npm install`

**WAIT FOR MY CONFIRMATION** of settings.

### 4.4 Add Environment Variables
This is **CRITICAL**. Add these environment variables in Vercel:

Click "Environment Variables" section and add:

1. **OPENAI_API_KEY**
   - Value: `[I'll provide this]`
   - Environment: Production, Preview, Development

2. **TWILIO_ACCOUNT_SID**
   - Value: `[I'll provide this]`
   - Environment: Production, Preview, Development

3. **TWILIO_AUTH_TOKEN**
   - Value: `[I'll provide this]`
   - Environment: Production, Preview, Development

4. **TWILIO_PHONE_NUMBER**
   - Value: `[I'll provide this - format: +15551234567]`
   - Environment: Production, Preview, Development

5. **USE_FIRESTORE**
   - Value: `true`
   - Environment: Production, Preview, Development

6. **FIREBASE_SERVICE_ACCOUNT_JSON**
   - Value: `[The entire JSON I copied earlier from firebase-service-account.json]`
   - Environment: Production, Preview, Development
   - **IMPORTANT:** This should be a single-line JSON string

7. **NODE_ENV**
   - Value: `production`
   - Environment: Production only

8. **BASE_URL**
   - Value: `[Leave empty for now - will update after first deployment]`
   - Environment: Production

**WAIT FOR MY CONFIRMATION** that ALL environment variables are added.

### 4.5 Deploy to Vercel
- Click "Deploy"
- Wait for deployment (2-5 minutes)
- Copy the deployment URL once it's ready

**WAIT FOR MY CONFIRMATION** that deployment succeeded and I have the URL.

### 4.6 Update BASE_URL Environment Variable
- Go to Project Settings → Environment Variables
- Edit `BASE_URL` and set it to the Vercel deployment URL (e.g., `https://my-app.vercel.app`)
- Redeploy: Deployments tab → Click "..." on latest → "Redeploy"

**WAIT FOR MY CONFIRMATION**.

### 4.7 Get Vercel IDs for GitHub Actions
- I need to install Vercel CLI or get these from dashboard
- Navigate to: https://vercel.com/[my-account]/[my-project]/settings/general
- Look for Project ID (or help me find it)

**Alternative:** Install Vercel CLI locally:
```bash
npm install -g vercel
vercel login
vercel link
cat .vercel/project.json
```

This gives me:
- `orgId` (VERCEL_ORG_ID)
- `projectId` (VERCEL_PROJECT_ID)

**WAIT FOR MY CONFIRMATION** that I have both IDs.

---

## STEP 5: GitHub Actions Setup

### 5.1 Get Vercel Token
- Navigate to: https://vercel.com/account/tokens
- Click "Create Token"
- Name: `github-actions-deployment`
- Scope: Full Account (or specific to my project)
- Click "Create"
- **Copy the token** (shown only once!)

**WAIT FOR MY CONFIRMATION** that I have the token.

### 5.2 Add GitHub Secrets
- Navigate to: `https://github.com/[my-username]/[my-repo]/settings/secrets/actions`
- Click "New repository secret" for each:

**Secret 1:**
- Name: `VERCEL_TOKEN`
- Value: `[The token I just created]`

**Secret 2:**
- Name: `VERCEL_ORG_ID`
- Value: `[From .vercel/project.json or Vercel dashboard]`

**Secret 3:**
- Name: `VERCEL_PROJECT_ID`
- Value: `[From .vercel/project.json or Vercel dashboard]`

**WAIT FOR MY CONFIRMATION** that all 3 secrets are added.

### 5.3 Test GitHub Actions
- Go to: `https://github.com/[my-username]/[my-repo]/actions`
- The deployment workflow should have run automatically when I pushed to `main`
- Check if it succeeded or failed
- If failed, help me debug the error

**WAIT FOR MY CONFIRMATION** on Actions status.

### 5.4 Verify Automatic Deployments
Make a small change to test CI/CD:
```bash
# Add a comment to index.js
git add .
git commit -m "test: Verify CI/CD pipeline"
git push origin main
```

- Watch GitHub Actions run
- Verify automatic deployment to Vercel

**WAIT FOR MY CONFIRMATION** that auto-deployment works.

---

## STEP 6: Twilio Configuration

### 6.1 Update Twilio Webhook URL
- Navigate to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
- Click on my phone number
- Under "Voice Configuration":
  - **A CALL COMES IN:** Webhook
  - **URL:** `https://[my-vercel-url].vercel.app/incoming-call`
  - **HTTP Method:** POST
- Click "Save"

**WAIT FOR MY CONFIRMATION** that Twilio is configured.

---

## STEP 7: Final Testing

### 7.1 Test Production Deployment
- Run: `curl https://[my-vercel-url].vercel.app/health`
- Expected response:
  - `"status": "healthy"`
  - `"database": "firestore"`

**WAIT FOR MY CONFIRMATION** of health check.

### 7.2 Make Test Call
- Call my Twilio phone number from my phone
- Verify I hear the AI assistant
- Have a brief conversation
- Hang up

**WAIT FOR MY CONFIRMATION** that call works.

### 7.3 Verify Data in Firestore
- Go to Firebase Console → Firestore Database → Data
- Check for new data from the call
- Look in collections: `webhook_queue`, `call_attempts`, `audit_log`

**WAIT FOR MY CONFIRMATION** that data is being stored.

### 7.4 Check Vercel Logs
- Go to Vercel Dashboard → Project → Deployments → Latest
- Click on "Functions" tab
- Check logs for any errors

**WAIT FOR MY CONFIRMATION** that logs look good.

---

## STEP 8: Monitor & Optimize

### 8.1 Set Up Monitoring
Help me configure:
- Vercel Analytics (if needed)
- Firebase usage alerts
- Error tracking

### 8.2 Review Firestore Indexes
- Check if indexes are all "Enabled" (not "Building")
- Go to Firebase Console → Firestore → Indexes

### 8.3 Documentation Review
- Verify all documentation is accurate
- Update any URLs or credentials in docs
- Create a README if needed

**WAIT FOR MY CONFIRMATION** that monitoring is set up.

---

## COMPLETION CHECKLIST

Please help me verify all these are complete:

- [ ] Firebase project created and configured
- [ ] Firestore database enabled with security rules
- [ ] Firestore indexes created
- [ ] Service account key generated and stored locally
- [ ] Local testing successful with Firestore
- [ ] Code committed and pushed to GitHub
- [ ] Vercel account created/logged in
- [ ] GitHub repository imported to Vercel
- [ ] All environment variables configured in Vercel
- [ ] First deployment successful
- [ ] Vercel IDs obtained
- [ ] Vercel token created
- [ ] GitHub secrets configured
- [ ] GitHub Actions workflow tested
- [ ] Automatic deployments working
- [ ] Twilio webhook updated to production URL
- [ ] Production health check passing
- [ ] Test call successful
- [ ] Data flowing to Firestore
- [ ] Monitoring configured

---

## CREDENTIALS SUMMARY

At the end, help me create a secure summary of:
- Firebase Project ID
- Vercel Project URL
- GitHub Repository
- All environment variables (with sensitive values masked)
- Twilio webhook URL
- Service account file location

---

## TROUBLESHOOTING GUIDE

If we encounter issues at any step, help me:
1. Identify the error
2. Check relevant logs (Vercel, Firebase, GitHub Actions)
3. Verify configuration
4. Suggest fixes
5. Test the fix

---

## IMPORTANT NOTES

- **Never commit** `firebase-service-account.json` to Git
- **Keep secure:** All API keys and tokens
- **Firestore costs:** Monitor usage to stay within free tier
- **Vercel limits:** Free tier has bandwidth and execution limits

---

## SUPPORT RESOURCES

If we get stuck:
- Firebase Console: https://console.firebase.google.com/
- Vercel Dashboard: https://vercel.com/dashboard
- GitHub Actions: https://github.com/[repo]/actions
- Local Documentation: See DEPLOYMENT.md, FIREBASE_SETUP.md

---

**START HERE:** Begin with Step 1.1 and guide me through each step, waiting for my confirmation before proceeding.

Current status: Ready to begin Firebase setup.
