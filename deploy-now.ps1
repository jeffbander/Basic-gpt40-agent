# Complete Google Cloud Run Deployment Script
# Run this in a NEW PowerShell window after installing Google Cloud CLI

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Medical AI System - Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Authenticate
Write-Host "Step 1: Authenticating with Google Cloud..." -ForegroundColor Yellow
Write-Host "This will open a browser window for authentication." -ForegroundColor Gray
Write-Host ""
gcloud auth login

# Step 2: Set Project
Write-Host ""
Write-Host "Step 2: Setting project..." -ForegroundColor Yellow
gcloud config set project amedical-ai-calling-system

# Step 3: Enable APIs
Write-Host ""
Write-Host "Step 3: Enabling required APIs..." -ForegroundColor Yellow
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.gcr.io
gcloud services enable secretmanager.googleapis.com
gcloud services enable cloudbuild.googleapis.com

# Step 4: Create Secrets
Write-Host ""
Write-Host "Step 4: Creating secrets..." -ForegroundColor Yellow
Write-Host "Reading from .env.production file..." -ForegroundColor Gray

if (Test-Path ".env.production") {
    $envLines = Get-Content ".env.production"

    # Extract values (handling multiline JSON)
    $openaiKey = ""
    $twilioSid = ""
    $twilioToken = ""
    $twilioNumber = ""
    $firebaseJson = ""
    $inFirebaseJson = $false

    foreach ($line in $envLines) {
        if ($line -match "^OPENAI_API_KEY=(.*)") {
            $openaiKey = $matches[1]
        }
        elseif ($line -match "^TWILIO_ACCOUNT_SID=(.*)") {
            $twilioSid = $matches[1]
        }
        elseif ($line -match "^TWILIO_AUTH_TOKEN=(.*)") {
            $twilioToken = $matches[1]
        }
        elseif ($line -match "^TWILIO_PHONE_NUMBER=(.*)") {
            $twilioNumber = $matches[1]
        }
        elseif ($line -match "^FIREBASE_SERVICE_ACCOUNT_JSON=(.*)") {
            $firebaseJson = $matches[1]
        }
    }

    # Create secrets
    Write-Host "Creating OPENAI_API_KEY..." -ForegroundColor Gray
    $openaiKey | gcloud secrets create openai-api-key --data-file=- 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Adding new version to existing secret..." -ForegroundColor Gray
        $openaiKey | gcloud secrets versions add openai-api-key --data-file=-
    }

    Write-Host "Creating TWILIO_ACCOUNT_SID..." -ForegroundColor Gray
    $twilioSid | gcloud secrets create twilio-account-sid --data-file=- 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        $twilioSid | gcloud secrets versions add twilio-account-sid --data-file=-
    }

    Write-Host "Creating TWILIO_AUTH_TOKEN..." -ForegroundColor Gray
    $twilioToken | gcloud secrets create twilio-auth-token --data-file=- 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        $twilioToken | gcloud secrets versions add twilio-auth-token --data-file=-
    }

    Write-Host "Creating TWILIO_PHONE_NUMBER..." -ForegroundColor Gray
    $twilioNumber | gcloud secrets create twilio-phone-number --data-file=- 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        $twilioNumber | gcloud secrets versions add twilio-phone-number --data-file=-
    }

    Write-Host "Creating FIREBASE_SERVICE_ACCOUNT_JSON..." -ForegroundColor Gray
    $firebaseJson | gcloud secrets create firebase-service-account --data-file=- 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        $firebaseJson | gcloud secrets versions add firebase-service-account --data-file=-
    }

    Write-Host "✅ All secrets created/updated" -ForegroundColor Green
} else {
    Write-Host "❌ .env.production not found!" -ForegroundColor Red
    exit 1
}

# Step 5: Deploy
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 5: Deploying to Cloud Run..." -ForegroundColor Yellow
Write-Host "This will take 5-10 minutes..." -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

gcloud run deploy medical-ai-calling-system `
    --source . `
    --region us-east1 `
    --platform managed `
    --allow-unauthenticated `
    --port 5051 `
    --timeout 3600 `
    --max-instances 10 `
    --min-instances 0 `
    --memory 512Mi `
    --cpu 1 `
    --set-env-vars "NODE_ENV=production,USE_FIRESTORE=true" `
    --update-secrets "OPENAI_API_KEY=openai-api-key:latest,TWILIO_ACCOUNT_SID=twilio-account-sid:latest,TWILIO_AUTH_TOKEN=twilio-auth-token:latest,TWILIO_PHONE_NUMBER=twilio-phone-number:latest,FIREBASE_SERVICE_ACCOUNT_JSON=firebase-service-account:latest"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✅ DEPLOYMENT SUCCESSFUL!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Yellow
    Write-Host "1. Find your Service URL in the output above" -ForegroundColor White
    Write-Host "2. Update Twilio webhooks with your new URL" -ForegroundColor White
    Write-Host "   - Go to: https://console.twilio.com/" -ForegroundColor Gray
    Write-Host "   - Phone Numbers → +18555291116" -ForegroundColor Gray
    Write-Host "   - Set webhook to: https://your-url/incoming-call" -ForegroundColor Gray
    Write-Host "3. Test your deployment!" -ForegroundColor White
    Write-Host ""
    Write-Host "View logs with:" -ForegroundColor Yellow
    Write-Host "  gcloud run logs tail medical-ai-calling-system --region us-east1" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Write-Host "Check the errors above" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
