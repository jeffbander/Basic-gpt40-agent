# Quick Firebase Setup Guide

This is a condensed guide to get Firebase set up quickly. For full deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## 1. Create Firebase Project (5 minutes)

1. Visit [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Project name: `medical-ai-calling` (or your preferred name)
4. Disable Google Analytics (optional)
5. Click "Create project"

## 2. Enable Firestore (2 minutes)

1. In Firebase Console, click "Firestore Database"
2. Click "Create database"
3. Select "Start in production mode"
4. Choose location: `us-east1` (or closest to you)
5. Click "Enable"

## 3. Configure Security Rules (1 minute)

In Firestore > Rules tab, paste this:

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

Click "Publish"

**Why?** This denies all client access. Only your server (Firebase Admin SDK) can access data.

## 4. Create Firestore Indexes (3 minutes)

Go to Firestore > Indexes tab, click "Add index" for each:

### Index 1: webhook_queue status + scheduled_time
- Collection ID: `webhook_queue`
- Fields:
  - `status` - Ascending
  - `scheduled_time` - Ascending
- Query scopes: Collection
- Click "Create"

### Index 2: webhook_queue phone_number + created_at
- Collection ID: `webhook_queue`
- Fields:
  - `phone_number` - Ascending
  - `created_at` - Descending
- Query scopes: Collection
- Click "Create"

### Index 3: audit_log event_type + created_at
- Collection ID: `audit_log`
- Fields:
  - `event_type` - Ascending
  - `created_at` - Descending
- Query scopes: Collection
- Click "Create"

**Note:** Indexes take a few minutes to build. You can deploy while they're building.

## 5. Generate Service Account Key (2 minutes)

1. Click ⚙️ (gear icon) > Project settings
2. Go to "Service accounts" tab
3. Click "Generate new private key"
4. Click "Generate key" (downloads JSON file)
5. Rename the file to `firebase-service-account.json`

### For Local Development:

```bash
# Move to the database directory
mv ~/Downloads/firebase-service-account.json ./call-management/database/

# Verify it's there
ls -la call-management/database/firebase-service-account.json
```

### For Vercel Production:

1. Open the JSON file
2. Copy the ENTIRE contents
3. In Vercel Dashboard > Your Project > Settings > Environment Variables
4. Add new variable:
   - **Name:** `FIREBASE_SERVICE_ACCOUNT_JSON`
   - **Value:** (paste the entire JSON)
   - **Environment:** Production, Preview, Development

Or use CLI to minify:
```bash
cat firebase-service-account.json | jq -c
```

## 6. Update .env File (1 minute)

In your `.env` file, add:

```bash
# Switch to Firestore
USE_FIRESTORE=true

# Local development - path to service account
FIREBASE_SERVICE_ACCOUNT_PATH=./call-management/database/firebase-service-account.json

# Optional - only if using Realtime Database
FIREBASE_DATABASE_URL=https://your-project-id.firebaseio.com
```

Replace `your-project-id` with your actual Firebase project ID.

## 7. Test Locally (2 minutes)

```bash
# Install dependencies (if not already done)
npm install

# Start the server
npm run start:medical

# In another terminal, test the health check
curl http://localhost:5051/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "firestore",
  "timestamp": "2025-10-09T..."
}
```

## Troubleshooting

### Error: "Cannot find module 'firebase-admin'"

```bash
npm install firebase-admin
```

### Error: "Firebase service account configuration not found"

Make sure:
1. File exists at `call-management/database/firebase-service-account.json`
2. Environment variable `USE_FIRESTORE=true` is set
3. Path in `.env` is correct

### Error: "Permission denied" when writing to Firestore

Check:
1. Security rules are set correctly (see step 3)
2. You're using Firebase Admin SDK (not client SDK)
3. Service account has proper permissions

### Indexes still building

Firestore indexes can take 5-10 minutes to build. You'll see:
- 🔨 Building - Wait for completion
- ✓ Enabled - Ready to use

You can still test basic operations while indexes build, but complex queries may fail.

## Next Steps

Once Firebase is working locally:

1. Follow [DEPLOYMENT.md](./DEPLOYMENT.md) to deploy to Vercel
2. Set up GitHub Actions for CI/CD
3. Configure Twilio webhook URLs
4. Test your production deployment

## Firebase Project Settings Summary

After setup, here's what you should have:

- ✅ Firebase project created
- ✅ Firestore Database enabled
- ✅ Security rules configured (server-side only)
- ✅ Indexes created (or building)
- ✅ Service account key downloaded
- ✅ Local environment configured
- ✅ App running with Firestore

## Cost Monitoring

Free tier limits (Spark Plan):
- **Storage:** 1 GB
- **Reads:** 50,000/day
- **Writes:** 20,000/day
- **Deletes:** 20,000/day

To monitor usage:
1. Firebase Console > Firestore Database
2. Click "Usage" tab
3. Set up billing alerts (recommended)

For production, consider upgrading to Blaze (pay-as-you-go) plan.

## Resources

- [Firebase Console](https://console.firebase.google.com/)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Full Deployment Guide](./DEPLOYMENT.md)

---

**Total setup time:** ~15 minutes

**Ready to deploy?** Continue with [DEPLOYMENT.md](./DEPLOYMENT.md)
