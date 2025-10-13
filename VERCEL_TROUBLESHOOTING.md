# Vercel Deployment Troubleshooting Guide

## Common Issues & Solutions

### Issue 1: Firebase JSON Variable Not Working

**Problem:** Vercel shows error when adding FIREBASE_SERVICE_ACCOUNT_JSON

**Solution:**
1. Open `VERCEL_ENV_VARIABLES.txt`
2. Find Variable 6 (FIREBASE_SERVICE_ACCOUNT_JSON)
3. Copy the ENTIRE JSON line
4. Open a text editor (Notepad)
5. Paste the JSON
6. Check for any accidental line breaks
7. Should be ONE continuous line
8. Copy from text editor
9. Paste into Vercel

**Alternative Method:**
```bash
# In terminal, run this to get clean JSON:
cat call-management/database/firebase-service-account.json | tr -d '\n' | tr -d ' '
```

---

### Issue 2: Deployment Fails with "Module not found"

**Problem:** Vercel build fails, can't find firebase-admin

**Solution:**
1. Check package.json includes: `"firebase-admin": "^13.5.0"`
2. In Vercel project settings:
   - Build Command: Leave empty or `npm install`
   - Install Command: `npm install`
3. Redeploy

---

### Issue 3: Environment Variables Not Loading

**Problem:** App can't read environment variables

**Solution:**
1. In Vercel Dashboard → Settings → Environment Variables
2. For EACH variable, make sure:
   - ✅ Production is checked
   - ✅ Preview is checked
   - ✅ Development is checked
3. After adding/editing variables:
   - Go to Deployments tab
   - Click "..." on latest deployment
   - Click "Redeploy"

---

### Issue 4: Firestore Connection Fails in Production

**Symptoms:**
- Local works fine
- Vercel deployment shows Firebase errors
- Logs show "Firebase not initialized"

**Solution:**
1. Verify FIREBASE_SERVICE_ACCOUNT_JSON is set in Vercel
2. Verify USE_FIRESTORE=true in Vercel
3. Check Vercel logs for exact error:
   - Deployments → Latest → Functions → View Logs
4. Common fixes:
   - Re-add FIREBASE_SERVICE_ACCOUNT_JSON
   - Ensure JSON has NO line breaks
   - Check JSON is valid (use JSON validator)

---

### Issue 5: WebSocket Timeout (60 seconds)

**Problem:** Long phone calls get disconnected after 60 seconds

**Cause:** Vercel serverless functions have 60-second timeout

**Solution Options:**

**Option A: Upgrade Vercel Plan**
- Pro plan: 5-minute timeout
- Enterprise: 15-minute timeout

**Option B: Use Vercel Edge Functions**
- Modify vercel.json:
```json
{
  "functions": {
    "index.js": {
      "runtime": "edge"
    }
  }
}
```

**Option C: Deploy WebSocket separately**
- Keep main app on Vercel
- Deploy WebSocket server on Railway/Render
- Update WebSocket URLs in code

---

### Issue 6: Twilio Webhooks Not Working

**Problem:** Calls don't connect, Twilio shows errors

**Checklist:**
1. ✅ Vercel deployment succeeded
2. ✅ Get your Vercel URL (e.g., https://your-app.vercel.app)
3. ✅ Add BASE_URL environment variable in Vercel
4. ✅ Update Twilio webhook:
   - URL: `https://your-app.vercel.app/incoming-call`
   - Method: POST
5. ✅ Test with a call

---

### Issue 7: GitHub Actions Failing

**Problem:** CI/CD pipeline fails on push

**Common Causes & Fixes:**

**Missing Secrets:**
- Go to: GitHub → Settings → Secrets → Actions
- Verify you have:
  - VERCEL_TOKEN
  - VERCEL_ORG_ID
  - VERCEL_PROJECT_ID

**Wrong Branch:**
- Check `.github/workflows/deploy.yml`
- Ensure branch is `main` (not `master`)

**Vercel CLI Issues:**
- Actions should install: `npm install --global vercel@latest`
- Check workflow logs for exact error

---

## Quick Checks

### 1. Verify Environment Variables Set:
Go to Vercel → Your Project → Settings → Environment Variables

Should see:
- ✅ OPENAI_API_KEY
- ✅ TWILIO_ACCOUNT_SID
- ✅ TWILIO_AUTH_TOKEN
- ✅ TWILIO_PHONE_NUMBER
- ✅ USE_FIRESTORE
- ✅ FIREBASE_SERVICE_ACCOUNT_JSON
- ✅ NODE_ENV
- ✅ BASE_URL (add after first deploy)

### 2. Check Deployment Status:
```
Vercel Dashboard → Deployments → Latest
- Should show: "Ready" with green checkmark
- If failed, click to see error logs
```

### 3. Test Health Endpoint:
```bash
curl https://your-app.vercel.app/
# Should return: {"message":"Medical Outbound Calling System V2"...}
```

### 4. Check Firebase Connection:
```bash
# Add this endpoint to test (temporary):
curl https://your-app.vercel.app/api/health
```

---

## Debugging Commands

### View Vercel Logs (Real-time):
```bash
vercel logs --follow
```

### List Deployments:
```bash
vercel ls
```

### Check Environment Variables (Local):
```bash
vercel env ls
```

### Pull Vercel Config Locally:
```bash
vercel env pull
```

---

## Getting Help

### 1. Check Vercel Logs First:
- Dashboard → Deployments → Latest → Functions
- Look for specific error messages

### 2. Firebase Console:
- https://console.firebase.google.com/
- Check Firestore → Usage
- Check for permission errors

### 3. GitHub Actions:
- https://github.com/jeffbander/Basic-gpt40-agent/actions
- Click on failed workflow
- Expand steps to see errors

### 4. Common Error Messages:

**"Cannot find module 'firebase-admin'"**
→ Run: `npm install firebase-admin` and redeploy

**"Firebase Admin SDK not initialized"**
→ Check FIREBASE_SERVICE_ACCOUNT_JSON in Vercel

**"EADDRINUSE: address already in use"**
→ Only happens locally, not in Vercel

**"Function execution timed out"**
→ Upgrade Vercel plan or use Edge Functions

---

## Success Checklist

When everything works:
- ✅ Vercel deployment shows "Ready"
- ✅ Health endpoint responds
- ✅ Can make test call
- ✅ Firestore shows data
- ✅ GitHub Actions pass
- ✅ No errors in Vercel logs

---

## Need More Help?

1. Check full deployment guide: `DEPLOYMENT.md`
2. Review Vercel docs: https://vercel.com/docs
3. Firebase docs: https://firebase.google.com/docs
4. Open issue on GitHub (without exposing credentials!)
