# Deployment Guide: Firebase + Vercel + GitHub CI/CD

This guide will walk you through deploying your Medical AI Calling System to production using Firebase for the database and Vercel for hosting, with automated deployments via GitHub Actions.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Firebase Setup](#firebase-setup)
3. [Vercel Setup](#vercel-setup)
4. [GitHub Setup](#github-setup)
5. [Environment Variables](#environment-variables)
6. [Deploying](#deploying)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, ensure you have:

- Node.js 20+ installed
- A GitHub account and repository for this project
- A Firebase account (free tier is fine to start)
- A Vercel account (free tier available)
- Your Twilio credentials
- Your OpenAI API key

---

## Firebase Setup

### Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or "Create a project"
3. Enter a project name (e.g., `medical-ai-calling`)
4. Disable Google Analytics (optional) or configure it
5. Click "Create project"

### Step 2: Enable Firestore Database

1. In your Firebase project, click "Firestore Database" in the left menu
2. Click "Create database"
3. Choose "Start in production mode" (we'll configure security rules later)
4. Select a location close to your users (e.g., `us-east1`)
5. Click "Enable"

### Step 3: Create Security Rules

In the Firestore Rules tab, add these security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow server-side access only (Firebase Admin SDK)
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Note:** These rules deny all client access. Only your server (via Firebase Admin SDK) can read/write data.

### Step 4: Create Firestore Indexes

Go to Firestore > Indexes and create these composite indexes:

1. **webhook_queue** collection:
   - Fields: `status` (Ascending), `scheduled_time` (Ascending)
   - Query scope: Collection

2. **webhook_queue** collection:
   - Fields: `phone_number` (Ascending), `created_at` (Descending)
   - Query scope: Collection

3. **audit_log** collection:
   - Fields: `event_type` (Ascending), `created_at` (Descending)
   - Query scope: Collection

### Step 5: Generate Service Account Key

1. In Firebase Console, click the gear icon (⚙️) > Project settings
2. Go to "Service accounts" tab
3. Click "Generate new private key"
4. Click "Generate key" - this downloads a JSON file
5. **IMPORTANT:** Rename this file to `firebase-service-account.json`
6. **NEVER commit this file to Git!** (already in .gitignore)

For local development:
```bash
# Move the file to the database directory
mv ~/Downloads/firebase-service-account.json ./call-management/database/
```

For Vercel (production):
- You'll copy the entire JSON content as an environment variable (see below)

---

## Vercel Setup

### Step 1: Install Vercel CLI (Optional)

```bash
npm install -g vercel
```

### Step 2: Connect Your Repository to Vercel

**Option A: Via Vercel Dashboard (Recommended)**

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." > "Project"
3. Import your GitHub repository
4. Configure your project:
   - **Framework Preset:** Other
   - **Root Directory:** ./
   - **Build Command:** (leave empty)
   - **Output Directory:** (leave empty)
5. Don't deploy yet - we need to add environment variables first

**Option B: Via CLI**

```bash
vercel login
vercel link
```

### Step 3: Get Vercel IDs for GitHub Actions

```bash
# Link your project
vercel link

# Get your Org ID and Project ID from .vercel/project.json
cat .vercel/project.json
```

Save these values - you'll need them for GitHub secrets.

---

## GitHub Setup

### Step 1: Add Repository Secrets

Go to your GitHub repository > Settings > Secrets and variables > Actions > New repository secret

Add the following secrets:

1. **VERCEL_TOKEN**
   - Go to [Vercel Account Settings](https://vercel.com/account/tokens)
   - Create a new token
   - Copy and save as secret

2. **VERCEL_ORG_ID**
   - From `.vercel/project.json` (see above)

3. **VERCEL_PROJECT_ID**
   - From `.vercel/project.json` (see above)

### Step 2: Enable GitHub Actions

The workflow file is already created at `.github/workflows/deploy.yml`. GitHub Actions will automatically:

- Run tests on every push
- Deploy preview on pull requests
- Deploy to production on push to `main` branch

---

## Environment Variables

### Vercel Environment Variables

In your Vercel project dashboard, go to Settings > Environment Variables and add:

#### Required for all environments:

1. **OPENAI_API_KEY**
   - Value: Your OpenAI API key (starts with `sk-proj-...`)
   - Environment: Production, Preview, Development

2. **TWILIO_ACCOUNT_SID**
   - Value: Your Twilio Account SID
   - Environment: Production, Preview, Development

3. **TWILIO_AUTH_TOKEN**
   - Value: Your Twilio Auth Token
   - Environment: Production, Preview, Development

4. **TWILIO_PHONE_NUMBER**
   - Value: Your Twilio phone number (e.g., `+15551234567`)
   - Environment: Production, Preview, Development

5. **USE_FIRESTORE**
   - Value: `true`
   - Environment: Production, Preview, Development

6. **FIREBASE_SERVICE_ACCOUNT_JSON**
   - Value: Copy the ENTIRE contents of your `firebase-service-account.json` file
   - Environment: Production, Preview, Development
   - **IMPORTANT:** This should be a single-line JSON string. You can minify it using:
     ```bash
     cat firebase-service-account.json | jq -c
     ```

7. **NODE_ENV**
   - Value: `production`
   - Environment: Production

8. **BASE_URL**
   - Value: Your Vercel production URL (e.g., `https://your-app.vercel.app`)
   - Environment: Production
   - **Note:** Update this after first deployment

#### Optional:

9. **ENABLE_RECORDING**
   - Value: `false` (or `true` if you have patient consent)
   - Environment: Production, Preview, Development

10. **FIREBASE_DATABASE_URL**
    - Value: `https://your-project-id.firebaseio.com`
    - Environment: Production, Preview, Development
    - Only needed if using Firebase Realtime Database

---

## Deploying

### Initial Deployment

#### Option 1: Via GitHub (Recommended)

```bash
# Commit and push your changes
git add .
git commit -m "feat: Add deployment configuration for Firebase and Vercel"
git push origin main
```

GitHub Actions will automatically:
1. Run tests
2. Deploy to Vercel production
3. Provide deployment URL in the Actions summary

#### Option 2: Via Vercel CLI

```bash
# Deploy to production
vercel --prod
```

### Updating Your Deployment

Simply push to your repository:

```bash
git add .
git commit -m "feat: Your feature description"
git push origin main
```

The CI/CD pipeline will automatically deploy.

### Preview Deployments

Create a pull request to get an automatic preview deployment:

```bash
git checkout -b feature/new-feature
# Make your changes
git add .
git commit -m "feat: Add new feature"
git push origin feature/new-feature
```

Then create a pull request on GitHub. A preview URL will be commented on the PR automatically.

---

## Post-Deployment Configuration

### Update Twilio Webhook URLs

After deploying, update your Twilio phone number configuration:

1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to Phone Numbers > Manage > Active numbers
3. Click on your phone number
4. Under "Voice Configuration":
   - **A CALL COMES IN:** Webhook
   - **URL:** `https://your-vercel-url.vercel.app/incoming-call`
   - **HTTP Method:** POST
5. Save

### Test Your Deployment

1. Call your Twilio phone number
2. Verify the AI assistant answers
3. Check Firestore to ensure data is being stored
4. Monitor Vercel logs for any errors

---

## Monitoring & Maintenance

### Vercel Logs

View real-time logs:
```bash
vercel logs --follow
```

Or in the Vercel Dashboard:
- Go to your project > Deployments
- Click on a deployment > Functions
- View logs for each function

### Firebase Console

Monitor your database:
1. Go to Firebase Console > Firestore Database
2. View collections and documents
3. Check usage metrics

### Health Checks

Add a health check endpoint to monitor your deployment:

```bash
curl https://your-vercel-url.vercel.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "firestore",
  "timestamp": "2025-10-09T..."
}
```

### Firestore Data Cleanup

Schedule periodic cleanup of old data to stay within free tier limits:

```bash
# This should be run as a scheduled job
# Use Vercel Cron Jobs or external scheduler
```

---

## Troubleshooting

### Common Issues

#### 1. "Firebase not initialized" error

**Cause:** `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable not set or invalid

**Solution:**
- Verify the environment variable is set in Vercel
- Ensure the JSON is valid (use `jq` to validate)
- Redeploy after adding the variable

#### 2. WebSocket connection fails

**Cause:** Vercel has a 60-second timeout for serverless functions

**Solution:**
- Consider using Vercel's Edge Functions for WebSocket connections
- Or deploy WebSocket server separately (e.g., Railway, Render)

#### 3. Database permission denied

**Cause:** Firestore security rules blocking access

**Solution:**
- Verify security rules allow server-side access
- Ensure you're using Firebase Admin SDK (not client SDK)

#### 4. Deployment fails with "Module not found"

**Cause:** Missing dependencies

**Solution:**
```bash
npm install
npm ci
vercel --prod
```

#### 5. High Firestore costs

**Cause:** Too many reads/writes

**Solution:**
- Review indexes and query patterns
- Implement caching where possible
- Use batch writes to reduce write operations
- Set up billing alerts in Firebase Console

### Getting Help

- **Vercel Support:** [vercel.com/support](https://vercel.com/support)
- **Firebase Support:** [firebase.google.com/support](https://firebase.google.com/support)
- **GitHub Issues:** Report bugs in your repository

---

## Security Best Practices

### HIPAA Compliance

This application handles patient data. Ensure:

1. **Enable audit logging** - already implemented in Firestore
2. **Encrypt data in transit** - Vercel and Firebase use HTTPS by default
3. **Secure access controls** - Firestore security rules properly configured
4. **Regular backups** - Enable Firebase automated backups
5. **Access monitoring** - Review Firebase Console audit logs

### Environment Variables

- **Never commit** `.env` files or `firebase-service-account.json`
- **Rotate secrets** regularly (API keys, tokens)
- **Use Vercel's secret management** - never hardcode secrets
- **Limit access** - Only give team members necessary permissions

### Database Security

```javascript
// Firestore security rules - server-side only access
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false; // Only server can access
    }
  }
}
```

---

## Rollback Plan

If a deployment causes issues:

### Via Vercel Dashboard:

1. Go to Deployments
2. Find the last working deployment
3. Click "..." > "Promote to Production"

### Via CLI:

```bash
# List deployments
vercel ls

# Rollback to a specific deployment
vercel rollback [deployment-url]
```

---

## Cost Estimation

### Free Tier Limits:

**Firebase (Spark Plan - Free)**
- Firestore: 1GB storage, 50K reads/day, 20K writes/day, 20K deletes/day
- Functions: Not used in this setup

**Vercel (Hobby Plan - Free)**
- 100GB bandwidth/month
- Unlimited deployments
- 100 hours serverless function execution time

**Estimated Monthly Costs for Production:**

With moderate usage (500 calls/month):
- Firebase: $0-5/month
- Vercel: Free (Hobby) or $20/month (Pro for team features)

Monitor your usage and upgrade as needed.

---

## Next Steps

1. Set up monitoring and alerts
2. Configure automated backups
3. Implement rate limiting
4. Add authentication for admin dashboard
5. Set up staging environment
6. Configure custom domain in Vercel
7. Enable Vercel Analytics

---

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Twilio Documentation](https://www.twilio.com/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)

---

**Need Help?** Open an issue in your repository or consult the documentation links above.

Good luck with your deployment!
