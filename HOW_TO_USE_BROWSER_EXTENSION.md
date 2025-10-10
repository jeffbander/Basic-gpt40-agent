# How to Use Browser Extension for Deployment

## Quick Start

### Step 1: Open the Browser Extension Guide

Open this file in your text editor:
```
BROWSER_EXTENSION_DEPLOYMENT_GUIDE.md
```

### Step 2: Copy the Entire Content

Select all content (Ctrl+A) and copy it (Ctrl+C)

### Step 3: Open Your Claude Code Browser Extension

- Open your browser (Chrome/Edge/Firefox)
- Click on the Claude Code extension icon
- Or navigate to the extension's chat interface

### Step 4: Paste the Guide

Paste the entire contents of `BROWSER_EXTENSION_DEPLOYMENT_GUIDE.md` into the Claude Code browser extension chat

### Step 5: Start the Guided Process

The extension will now guide you through each step, waiting for your approval before proceeding.

---

## What the Extension Will Do

The browser extension will help you with these **browser-based tasks**:

1. **Firebase Console Setup** (15 min)
   - Create Firebase project
   - Enable Firestore
   - Configure security rules
   - Create indexes
   - Generate service account key

2. **Vercel Dashboard Setup** (10 min)
   - Import GitHub repository
   - Configure project settings
   - Add environment variables
   - Deploy application
   - Get project IDs

3. **GitHub Configuration** (5 min)
   - Create Vercel token
   - Add repository secrets
   - Verify Actions workflow

4. **Twilio Console** (2 min)
   - Update webhook URLs

5. **Testing & Verification** (5 min)
   - Test production deployment
   - Verify data flow
   - Check logs

---

## What You'll Need to Do Manually (Terminal)

Some steps require terminal commands. The extension will tell you when, but here's a preview:

### Local Testing
```bash
# Update .env file (you can do this manually or let extension guide you)
echo "USE_FIRESTORE=true" >> .env

# Test locally
npm run start:medical
curl http://localhost:5051/health
```

### Git Operations
```bash
# Commit deployment files
git add .github/ call-management/database/firestore-connection.js call-management/database/db-adapter.js vercel.json .vercelignore .env.example .gitignore *.md
git commit -m "feat: Add Firebase/Vercel deployment configuration with CI/CD"

# Merge to main (if needed)
git checkout main
git merge NGROK-working
git push origin main
```

### Vercel CLI (Optional)
```bash
# Get Vercel IDs
npm install -g vercel
vercel login
vercel link
cat .vercel/project.json
```

---

## Helpful Tips

### 1. Have These Ready Before Starting

**Credentials:**
- [ ] Twilio Account SID
- [ ] Twilio Auth Token
- [ ] Twilio Phone Number
- [ ] OpenAI API Key

**Accounts:**
- [ ] GitHub account (already have)
- [ ] Firebase account (will create/login)
- [ ] Vercel account (will create/login)

### 2. Keep a Notepad Open

Save these as you go:
- Firebase Project ID
- Vercel Deployment URL
- Vercel Org ID
- Vercel Project ID
- Vercel Token
- Firebase service account JSON (full contents)

### 3. Use the Checklist

Open `DEPLOYMENT_CHECKLIST.md` in a separate window to track your progress

### 4. Screenshots Are Helpful

Take screenshots of:
- Firebase project settings
- Vercel environment variables
- GitHub secrets
- Final deployment URLs

---

## The Extension Workflow

### Phase 1: Firebase (Browser)
Extension guides you through Firebase Console:
- Creating project
- Enabling Firestore
- Configuring security
- Creating indexes
- Downloading service account

### Phase 2: Local Testing (Terminal)
You'll run commands in terminal:
- Move service account file
- Update .env
- Test connection
- Verify Firestore

### Phase 3: GitHub (Terminal + Browser)
- Commit files (terminal)
- Push to GitHub (terminal)
- Configure secrets (browser via extension)

### Phase 4: Vercel (Browser)
Extension guides you through Vercel dashboard:
- Import repository
- Add environment variables
- Deploy
- Get project IDs

### Phase 5: CI/CD (Browser + Terminal)
- Create Vercel token (browser)
- Add GitHub secrets (browser)
- Test deployment (terminal + browser)

### Phase 6: Twilio (Browser)
Extension helps update Twilio webhooks

### Phase 7: Testing (Browser + Terminal)
- Health checks (terminal)
- Test calls (phone)
- Verify data (browser)
- Check logs (browser)

---

## Troubleshooting the Extension

### If Extension Gets Stuck

1. **Re-paste the guide** - Start fresh
2. **Skip to specific step** - Tell extension "Skip to Step X"
3. **Ask for clarification** - "Explain Step X in more detail"

### If Extension Can't Help with Terminal

1. Open the `DEPLOYMENT_CHECKLIST.md`
2. Find the command you need
3. Run it manually
4. Report back to extension with results

### If You Get Errors

Tell the extension:
- What step you're on
- What error you see
- What you've already tried

---

## Alternative: Step-by-Step Manual Process

If you prefer not to use the extension, you can:

1. **Follow QUICKSTART_DEPLOYMENT.md** - 30-minute condensed guide
2. **Follow FIREBASE_SETUP.md** - Just Firebase setup
3. **Follow DEPLOYMENT.md** - Complete detailed guide
4. **Use DEPLOYMENT_CHECKLIST.md** - Track your progress

---

## After Successful Deployment

### Document Everything

Create a file with:
```
PRODUCTION_INFO.md

Firebase Project: [project-id]
Firestore URL: https://console.firebase.google.com/project/[project-id]/firestore
Vercel URL: https://[your-app].vercel.app
GitHub Repo: https://github.com/[user]/[repo]
Service Account: call-management/database/firebase-service-account.json

Twilio Webhook: https://[your-app].vercel.app/incoming-call
```

### Set Up Monitoring

- Firebase Console: Check usage daily
- Vercel Dashboard: Monitor function execution
- GitHub Actions: Watch for failed deployments

### Test Regularly

```bash
# Health check
curl https://[your-app].vercel.app/health

# Make test call
[Call your Twilio number]

# Check Firestore
[Open Firebase Console → Firestore → Data]
```

---

## Getting Help

### If Browser Extension Isn't Working

1. **Use the manual guides:**
   - Start with `QUICKSTART_DEPLOYMENT.md`
   - Reference `DEPLOYMENT.md` for details
   - Use `DEPLOYMENT_CHECKLIST.md` to track progress

2. **Break it down by phase:**
   - Firebase: `FIREBASE_SETUP.md`
   - Vercel: `DEPLOYMENT.md` Step 3
   - GitHub Actions: `DEPLOYMENT.md` Step 4

3. **Check the documentation:**
   - All steps are documented in detail
   - Code examples provided
   - Troubleshooting sections included

### If Deployment Fails

1. **Check Vercel logs:**
   ```bash
   vercel logs --follow
   ```

2. **Check Firebase:**
   - Console → Firestore → Rules
   - Console → Firestore → Indexes
   - Console → Firestore → Data

3. **Check GitHub Actions:**
   - Go to repo → Actions tab
   - Click on failed workflow
   - Review error messages

### Resources

- Firebase Docs: https://firebase.google.com/docs
- Vercel Docs: https://vercel.com/docs
- GitHub Actions: https://docs.github.com/actions
- Your local docs: All the .md files in this project

---

## Success Indicators

You'll know deployment is successful when:

✅ Health check returns `{"status":"healthy","database":"firestore"}`
✅ Test call connects to AI assistant
✅ Firestore shows new data after call
✅ GitHub Actions shows successful deployment
✅ Vercel dashboard shows no errors
✅ No errors in Vercel function logs

---

## Security Checklist

Before going live:

- [ ] `firebase-service-account.json` NOT in Git
- [ ] All `.env` files in `.gitignore`
- [ ] Environment variables set in Vercel (not hardcoded)
- [ ] Firestore security rules deny client access
- [ ] HTTPS enforced (automatic with Vercel)
- [ ] API keys rotated if exposed

---

## Next Steps After Deployment

1. **Set up staging environment** (optional)
   - Create separate Firebase project
   - Deploy to Vercel preview
   - Test before production

2. **Add custom domain** (optional)
   - Buy domain
   - Add to Vercel
   - Update Twilio webhooks

3. **Enable monitoring**
   - Vercel Analytics
   - Firebase monitoring
   - Error tracking (Sentry, etc.)

4. **Review costs**
   - Firebase usage
   - Vercel bandwidth
   - Set up billing alerts

---

## Quick Reference Card

**Start deployment:**
1. Copy `BROWSER_EXTENSION_DEPLOYMENT_GUIDE.md`
2. Paste into Claude Code browser extension
3. Follow step-by-step instructions
4. Use `DEPLOYMENT_CHECKLIST.md` to track progress

**Total time:** ~50 minutes
**Difficulty:** Intermediate
**Prerequisites:** GitHub repo ready, credentials available

---

**Ready to begin?**

1. ✅ Open `BROWSER_EXTENSION_DEPLOYMENT_GUIDE.md`
2. ✅ Copy entire contents
3. ✅ Open Claude Code browser extension
4. ✅ Paste and follow instructions

Good luck! 🚀
