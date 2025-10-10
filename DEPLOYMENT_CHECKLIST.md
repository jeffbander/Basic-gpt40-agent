# Deployment Checklist - Quick Reference

Use this alongside the browser extension guide for quick status tracking.

## Pre-Deployment Info

**Repository:** Check with `git remote -v`
**Branch:** NGROK-working → will merge to main
**Local Path:** `C:\Users\jeffr\gpt40\Basic-gpt40-agent`

---

## Phase 1: Firebase Setup ⏱️ 15 min

### [ ] 1. Create Project
- URL: https://console.firebase.google.com/
- Name: `medical-ai-calling-system`
- Analytics: Optional

### [ ] 2. Enable Firestore
- Mode: Production
- Location: `us-east1` or closest

### [ ] 3. Security Rules
```js
match /{document=**} { allow read, write: if false; }
```

### [ ] 4. Create Indexes (3 total)
- webhook_queue: status + scheduled_time
- webhook_queue: phone_number + created_at
- audit_log: event_type + created_at

### [ ] 5. Service Account Key
- Download JSON
- Rename: `firebase-service-account.json`
- Move to: `call-management/database/`
- Copy JSON content (save for Vercel)

### [ ] 6. Update .env
```bash
USE_FIRESTORE=true
FIREBASE_SERVICE_ACCOUNT_PATH=./call-management/database/firebase-service-account.json
```

---

## Phase 2: Local Testing ⏱️ 5 min

### [ ] 1. Install Dependencies
```bash
npm install
```

### [ ] 2. Start Server
```bash
npm run start:medical
```

### [ ] 3. Test Health
```bash
curl http://localhost:5051/health
```
Should see: `"database": "firestore"`

### [ ] 4. Check Firestore
Firebase Console → Firestore → Data
Verify `call_rules` collection exists

---

## Phase 3: GitHub Prep ⏱️ 5 min

### [ ] 1. Commit Changes
```bash
git add .github/ call-management/database/firestore-connection.js call-management/database/db-adapter.js vercel.json .vercelignore .env.example .gitignore *.md
git commit -m "feat: Add Firebase/Vercel deployment configuration with CI/CD"
```

### [ ] 2. Merge to Main (optional)
```bash
git checkout main
git merge NGROK-working
git push origin main
```

---

## Phase 4: Vercel Setup ⏱️ 10 min

### [ ] 1. Login
- URL: https://vercel.com/signup
- Use GitHub login

### [ ] 2. Import Repo
- Add New → Project
- Import your repository

### [ ] 3. Project Settings
- Framework: Other
- Build: (empty)
- Output: (empty)

### [ ] 4. Environment Variables
Add these 8 variables:

| Variable | Value | Env |
|----------|-------|-----|
| OPENAI_API_KEY | `sk-proj-...` | All |
| TWILIO_ACCOUNT_SID | `AC...` | All |
| TWILIO_AUTH_TOKEN | `...` | All |
| TWILIO_PHONE_NUMBER | `+1...` | All |
| USE_FIRESTORE | `true` | All |
| FIREBASE_SERVICE_ACCOUNT_JSON | `{...}` | All |
| NODE_ENV | `production` | Prod |
| BASE_URL | `https://...vercel.app` | Prod |

### [ ] 5. Deploy
- Click "Deploy"
- Wait 2-5 minutes
- Copy deployment URL

### [ ] 6. Update BASE_URL
- Add deployment URL to BASE_URL variable
- Redeploy

### [ ] 7. Get Vercel IDs
Option A - CLI:
```bash
npm install -g vercel
vercel login
vercel link
cat .vercel/project.json
```

Option B - Dashboard:
- Settings → General → Project ID

---

## Phase 5: GitHub Actions ⏱️ 5 min

### [ ] 1. Get Vercel Token
- URL: https://vercel.com/account/tokens
- Create token: `github-actions-deployment`
- Copy token

### [ ] 2. Add GitHub Secrets
- URL: `https://github.com/[user]/[repo]/settings/secrets/actions`
- Add 3 secrets:
  - `VERCEL_TOKEN`
  - `VERCEL_ORG_ID`
  - `VERCEL_PROJECT_ID`

### [ ] 3. Test Workflow
- Check: `https://github.com/[user]/[repo]/actions`
- Verify deployment ran

### [ ] 4. Test Auto-Deploy
```bash
git commit --allow-empty -m "test: CI/CD"
git push origin main
```

---

## Phase 6: Twilio Config ⏱️ 2 min

### [ ] Update Webhook
- URL: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
- Click your number
- Voice Config:
  - Webhook: `https://[vercel-url].vercel.app/incoming-call`
  - Method: POST
- Save

---

## Phase 7: Testing ⏱️ 5 min

### [ ] 1. Health Check
```bash
curl https://[vercel-url].vercel.app/health
```

### [ ] 2. Test Call
- Call Twilio number
- Verify AI answers
- Have conversation
- Hang up

### [ ] 3. Check Firestore
- Firebase Console → Firestore → Data
- Verify new data in collections

### [ ] 4. Check Logs
- Vercel → Deployments → Latest → Functions
- Review logs

---

## Phase 8: Final Steps ⏱️ 5 min

### [ ] 1. Monitor Setup
- Vercel Analytics (optional)
- Firebase usage alerts
- Error tracking

### [ ] 2. Verify Indexes
- Firebase → Firestore → Indexes
- All should be "Enabled"

### [ ] 3. Document URLs
Save these:
- Firebase Project ID: `_______`
- Vercel URL: `https://_______`
- GitHub Repo: `https://github.com/_______`
- Service Account: `call-management/database/firebase-service-account.json`

---

## ✅ Final Checklist

- [ ] Firebase configured and working
- [ ] Local testing passed
- [ ] Code pushed to GitHub
- [ ] Vercel deployed successfully
- [ ] GitHub Actions configured
- [ ] Auto-deployments working
- [ ] Twilio webhook updated
- [ ] Production call test passed
- [ ] Data flowing to Firestore
- [ ] Monitoring enabled

---

## 🆘 Quick Troubleshooting

| Issue | Fix |
|-------|-----|
| "Firebase not initialized" | Check FIREBASE_SERVICE_ACCOUNT_JSON in Vercel |
| WebSocket timeout | Vercel has 60s limit, consider Edge Functions |
| Deployment fails | Check Vercel logs, verify env vars |
| Call doesn't work | Verify Twilio webhook URL, check Vercel logs |
| No data in Firestore | Check security rules, verify credentials |

---

## 📊 Cost Estimates

**Free Tier:**
- Firebase: 50k reads/day, 20k writes/day
- Vercel: 100GB bandwidth, 100hrs execution

**Production (estimated):**
- Firebase: $5-20/month
- Vercel Pro: $20/month
- **Total: ~$25-40/month**

---

## 🔐 Security Reminders

- ✅ `firebase-service-account.json` in .gitignore
- ✅ Security rules deny client access
- ✅ Env vars in Vercel (not in code)
- ✅ HTTPS enforced by default

---

**Total Time:** ~50 minutes
**Difficulty:** Intermediate

**Ready?** Open browser extension and paste `BROWSER_EXTENSION_DEPLOYMENT_GUIDE.md`
