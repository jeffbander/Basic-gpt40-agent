# Google Cloud Run Deployment Guide

## Prerequisites

You already have:
- ✅ Google Cloud project: `amedical-ai-calling-system`
- ✅ Firestore enabled
- ✅ Firebase service account credentials

## Step 1: Install Google Cloud CLI

### Windows Installation:
1. Download the installer: https://cloud.google.com/sdk/docs/install
2. Run the installer
3. Restart your terminal/command prompt
4. Verify installation: `gcloud --version`

### Quick Install (PowerShell):
```powershell
(New-Object Net.WebClient).DownloadFile("https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe", "$env:Temp\GoogleCloudSDKInstaller.exe")
& $env:Temp\GoogleCloudSDKInstaller.exe
```

## Step 2: Authenticate and Configure

```bash
# Login to Google Cloud
gcloud auth login

# Set your project
gcloud config set project amedical-ai-calling-system

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.gcr.io
gcloud services enable secretmanager.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

## Step 3: Create Secrets in Google Cloud Secret Manager

You need to create secrets for your environment variables:

```bash
# Create OPENAI_API_KEY secret
echo -n "YOUR_OPENAI_API_KEY" | gcloud secrets create openai-api-key --data-file=-

# Create TWILIO_ACCOUNT_SID secret
echo -n "YOUR_TWILIO_ACCOUNT_SID" | gcloud secrets create twilio-account-sid --data-file=-

# Create TWILIO_AUTH_TOKEN secret
echo -n "YOUR_TWILIO_AUTH_TOKEN" | gcloud secrets create twilio-auth-token --data-file=-

# Create TWILIO_PHONE_NUMBER secret
echo -n "+YOUR_PHONE_NUMBER" | gcloud secrets create twilio-phone-number --data-file=-

# Create FIREBASE_SERVICE_ACCOUNT_JSON secret
# Download your service account JSON from Firebase Console and save it to a file
gcloud secrets create firebase-service-account --data-file=path/to/your-service-account.json
```

## Step 4: Deploy to Google Cloud Run

### Option A: Simple Deployment (Recommended)

```bash
# Build and deploy in one command
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

### Option B: Using Cloud Build (For CI/CD)

```bash
# Submit build to Cloud Build
gcloud builds submit --config cloudbuild.yaml
```

## Step 5: Get Your Deployment URL

After deployment completes, you'll see output like:

```
Service [medical-ai-calling-system] revision [medical-ai-calling-system-00001-xyz] has been deployed and is serving 100 percent of traffic.
Service URL: https://medical-ai-calling-system-xxxxx-ue.a.run.app
```

**Save this URL!** You'll need it for Twilio webhooks.

## Step 6: Update Twilio Webhooks

1. Go to Twilio Console: https://console.twilio.com/
2. Navigate to Phone Numbers → Manage → Active Numbers
3. Select your number: +18555291116
4. Update webhooks:
   - **Incoming Call Webhook**: `https://your-cloud-run-url.app/incoming-call`
   - **Outbound Webhooks**: `https://your-cloud-run-url.app/outbound/*`

## Step 7: Test Your Deployment

```bash
# Health check
curl https://your-cloud-run-url.app/

# View logs
gcloud run logs read medical-ai-calling-system --region us-east1 --limit 50
```

## Cost Monitoring

Set up billing alerts:
```bash
# View current usage
gcloud billing accounts list
gcloud alpha billing budgets list

# Create budget alert
gcloud alpha billing budgets create \
  --billing-account=YOUR_BILLING_ACCOUNT_ID \
  --display-name="Medical AI System Budget" \
  --budget-amount=20 \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100
```

## Updating Your Deployment

When you make code changes:

```bash
# Quick update
gcloud run deploy medical-ai-calling-system \
  --source . \
  --region us-east1
```

## Troubleshooting

### View Logs
```bash
gcloud run logs tail medical-ai-calling-system --region us-east1
```

### Check Service Status
```bash
gcloud run services describe medical-ai-calling-system --region us-east1
```

### Rollback to Previous Version
```bash
# List revisions
gcloud run revisions list --service medical-ai-calling-system --region us-east1

# Rollback
gcloud run services update-traffic medical-ai-calling-system \
  --to-revisions REVISION_NAME=100 \
  --region us-east1
```

## Security Best Practices

1. ✅ Secrets are stored in Secret Manager (not in code)
2. ✅ Firestore has built-in security
3. ✅ HTTPS enforced by default
4. ✅ Consider enabling Cloud Armor for DDoS protection
5. ⚠️  Currently allows unauthenticated access (needed for Twilio webhooks)

## Next Steps

- Set up Cloud Logging alerts for errors
- Configure uptime monitoring
- Set up automated backups for Firestore
- Consider adding Cloud CDN for static assets
