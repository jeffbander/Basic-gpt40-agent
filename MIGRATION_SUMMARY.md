# Migration to Google Cloud Run - Summary

## ✅ What We've Completed

### 1. **Firestore Integration**
- ✅ Added Firebase Admin SDK to `outbound-medical-v2.js`
- ✅ Updated PatientManager class to use Firestore instead of file system
- ✅ All data now persists to Firestore collections:
  - `patients` - Patient records
  - `callTranscripts` - Call transcripts
  - `archivedPatients` - Archived patient data
- ✅ Backward compatible - falls back to file system if Firestore is not available

### 2. **Docker Configuration**
- ✅ Created `Dockerfile` optimized for Node.js applications
- ✅ Created `.dockerignore` to exclude unnecessary files
- ✅ Container configured for Cloud Run deployment

### 3. **Google Cloud Configuration**
- ✅ Created `cloudbuild.yaml` for automated CI/CD
- ✅ Configured Cloud Run settings:
  - 60-minute timeout (supports long calls!)
  - Auto-scaling (0 to 10 instances)
  - 512MB memory, 1 vCPU
  - WebSocket support enabled

### 4. **Deployment Tools**
- ✅ Created `GOOGLE_CLOUD_DEPLOYMENT.md` - Comprehensive deployment guide
- ✅ Created `deploy-to-cloud-run.ps1` - One-click deployment script for Windows

## 📊 Cost Comparison

### Vercel (Current - Not Working)
- **Pro Plan**: $20/month
- **Problem**: 60-second timeout (your calls need up to 5 minutes!)
- **Status**: ❌ Not suitable for your use case

### Google Cloud Run (Recommended)
- **Free Tier**:
  - 2 million requests/month
  - 360,000 vCPU-seconds/month
  - 180,000 GiB-seconds/month

- **Estimated Cost for Your Usage**:
  - 100 calls/month @ 3 min each: **~$1-2/month**
  - 500 calls/month @ 3 min each: **~$10-15/month**

- **Firestore Cost**:
  - Storage (1GB): $0.18/month
  - Reads/Writes: ~$0.15/month

- **Total Estimated**: **$2-15/month** (vs. Vercel Pro at $20/month with timeouts!)

## 🎯 Key Benefits

1. **No Timeout Issues** ✅
   - Supports calls up to 60 minutes
   - No more failed long calls

2. **Cost Effective** ✅
   - Pay only when calls are active
   - Likely stay in free tier initially

3. **Scalable** ✅
   - Auto-scales from 0 to 10 instances
   - Handles traffic spikes automatically

4. **Integrated with Your Existing Setup** ✅
   - Uses your existing Google Cloud project
   - Firestore already configured
   - No data migration needed

5. **HIPAA Compliant** ✅
   - Google Cloud offers HIPAA compliance
   - Firestore has built-in security

## 🚀 Next Steps

### Step 1: Install Google Cloud CLI
Download and install from: https://cloud.google.com/sdk/docs/install

**Or** use PowerShell quick-install:
```powershell
(New-Object Net.WebClient).DownloadFile("https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe", "$env:Temp\GoogleCloudSDKInstaller.exe")
& $env:Temp\GoogleCloudSDKInstaller.exe
```

### Step 2: Authenticate
```bash
gcloud auth login
gcloud config set project amedical-ai-calling-system
```

### Step 3: Create Secrets (One-time)
Run the PowerShell script:
```powershell
.\deploy-to-cloud-run.ps1
```
Choose option 1 to create secrets.

**Important**: You'll also need to manually create the Firebase service account secret:
```bash
gcloud secrets create firebase-service-account --data-file=firebase-key.json
```

### Step 4: Deploy
Run the PowerShell script again:
```powershell
.\deploy-to-cloud-run.ps1
```
Choose option 2 to deploy.

**Or** use the manual command:
```bash
gcloud run deploy medical-ai-calling-system \
  --source . \
  --region us-east1 \
  --platform managed \
  --allow-unauthenticated \
  --port 5051 \
  --timeout 3600 \
  --max-instances 10 \
  --min-instances 0 \
  --memory 512Mi \
  --cpu 1 \
  --set-env-vars NODE_ENV=production,USE_FIRESTORE=true \
  --update-secrets OPENAI_API_KEY=openai-api-key:latest,TWILIO_ACCOUNT_SID=twilio-account-sid:latest,TWILIO_AUTH_TOKEN=twilio-auth-token:latest,TWILIO_PHONE_NUMBER=twilio-phone-number:latest,FIREBASE_SERVICE_ACCOUNT_JSON=firebase-service-account:latest
```

### Step 5: Update Twilio Webhooks
After deployment, you'll get a URL like:
`https://medical-ai-calling-system-xxxxx-ue.a.run.app`

Update your Twilio webhooks:
1. Go to https://console.twilio.com/
2. Phone Numbers → Manage → Active Numbers
3. Select +18555291116
4. Update webhook URLs to your new Cloud Run URL

### Step 6: Test!
```bash
# Health check
curl https://your-cloud-run-url.app/

# View logs
gcloud run logs tail medical-ai-calling-system --region us-east1

# Make a test call
```

## 📁 Files Created/Modified

### New Files:
- `Dockerfile` - Container configuration
- `.dockerignore` - Docker build exclusions
- `cloudbuild.yaml` - CI/CD configuration
- `GOOGLE_CLOUD_DEPLOYMENT.md` - Detailed deployment guide
- `deploy-to-cloud-run.ps1` - Deployment script
- `MIGRATION_SUMMARY.md` - This file

### Modified Files:
- `outbound-medical-v2.js` - Added Firestore integration
  - Updated PatientManager class
  - All async operations now use Firestore
  - Backward compatible with file system

## 🔍 Testing Checklist

After deployment, verify:
- [ ] Health endpoint responds: `GET /`
- [ ] Patients API works: `GET /api/patients`
- [ ] Can create patient: `POST /api/patients`
- [ ] Inbound calls connect: Call your Twilio number
- [ ] Outbound calls work: `POST /outbound/initiate-call`
- [ ] Dashboard loads: `GET /patient-dashboard-v2.html`
- [ ] Firestore shows data in Firebase Console
- [ ] Logs appear in Cloud Console

## 💡 Tips

1. **Monitor Costs**: Set up billing alerts in Google Cloud Console
2. **Watch Logs**: `gcloud run logs tail medical-ai-calling-system --region us-east1`
3. **Quick Updates**: Just run `gcloud run deploy medical-ai-calling-system --source .` for updates
4. **Rollback**: Easy to rollback to previous versions in Cloud Console

## 🆘 Troubleshooting

### "Secrets not found"
Make sure you created all secrets in Secret Manager (Step 3 above)

### "Port not listening"
Check that PORT environment variable is set (Cloud Run sets this automatically)

### "Firestore permission denied"
Verify Firebase service account has Firestore permissions

### "Timeout errors"
Check Cloud Run timeout setting (should be 3600 seconds)

## 📚 Additional Resources

- [Google Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Cloud Run Pricing Calculator](https://cloud.google.com/products/calculator)
- [HIPAA Compliance on GCP](https://cloud.google.com/security/compliance/hipaa)

---

**Questions?** Check `GOOGLE_CLOUD_DEPLOYMENT.md` for detailed instructions, or view logs with the deployment script (option 3).
