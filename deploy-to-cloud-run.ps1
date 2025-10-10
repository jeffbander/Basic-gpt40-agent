# Medical AI System - Google Cloud Run Deployment Script
# Run this script in PowerShell

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Medical AI System - Cloud Run Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if gcloud is installed
Write-Host "Checking for Google Cloud CLI..." -ForegroundColor Yellow
if (!(Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Google Cloud CLI is not installed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install it from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or run this command to quick-install:" -ForegroundColor Yellow
    Write-Host '(New-Object Net.WebClient).DownloadFile("https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe", "$env:Temp\GoogleCloudSDKInstaller.exe"); & $env:Temp\GoogleCloudSDKInstaller.exe' -ForegroundColor Cyan
    exit 1
}

Write-Host "✅ Google Cloud CLI found" -ForegroundColor Green
Write-Host ""

# Set project
$PROJECT_ID = "amedical-ai-calling-system"
Write-Host "Setting project to: $PROJECT_ID" -ForegroundColor Yellow
gcloud config set project $PROJECT_ID

Write-Host ""
Write-Host "Enabling required APIs..." -ForegroundColor Yellow
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.gcr.io
gcloud services enable secretmanager.googleapis.com
gcloud services enable cloudbuild.googleapis.com

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DEPLOYMENT OPTIONS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "1. Create Secrets (First time only)" -ForegroundColor White
Write-Host "2. Deploy Application" -ForegroundColor White
Write-Host "3. View Logs" -ForegroundColor White
Write-Host "4. View Service Status" -ForegroundColor White
Write-Host "5. Exit" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Enter your choice (1-5)"

switch ($choice) {
    1 {
        Write-Host ""
        Write-Host "Creating secrets in Secret Manager..." -ForegroundColor Yellow
        Write-Host "⚠️  This should only be done once!" -ForegroundColor Red
        Write-Host ""

        # Read .env.production file
        if (Test-Path ".env.production") {
            $envContent = Get-Content ".env.production"

            # Extract values
            $OPENAI_KEY = ($envContent | Select-String "OPENAI_API_KEY=(.*)").Matches.Groups[1].Value
            $TWILIO_SID = ($envContent | Select-String "TWILIO_ACCOUNT_SID=(.*)").Matches.Groups[1].Value
            $TWILIO_TOKEN = ($envContent | Select-String "TWILIO_AUTH_TOKEN=(.*)").Matches.Groups[1].Value
            $TWILIO_NUMBER = ($envContent | Select-String "TWILIO_PHONE_NUMBER=(.*)").Matches.Groups[1].Value

            # Create secrets
            Write-Host "Creating OPENAI_API_KEY secret..."
            echo $OPENAI_KEY | gcloud secrets create openai-api-key --data-file=- 2>$null
            if ($LASTEXITCODE -eq 0) { Write-Host "✅ Created" -ForegroundColor Green } else { Write-Host "⚠️  Already exists or error" -ForegroundColor Yellow }

            Write-Host "Creating TWILIO_ACCOUNT_SID secret..."
            echo $TWILIO_SID | gcloud secrets create twilio-account-sid --data-file=- 2>$null
            if ($LASTEXITCODE -eq 0) { Write-Host "✅ Created" -ForegroundColor Green } else { Write-Host "⚠️  Already exists or error" -ForegroundColor Yellow }

            Write-Host "Creating TWILIO_AUTH_TOKEN secret..."
            echo $TWILIO_TOKEN | gcloud secrets create twilio-auth-token --data-file=- 2>$null
            if ($LASTEXITCODE -eq 0) { Write-Host "✅ Created" -ForegroundColor Green } else { Write-Host "⚠️  Already exists or error" -ForegroundColor Yellow }

            Write-Host "Creating TWILIO_PHONE_NUMBER secret..."
            echo $TWILIO_NUMBER | gcloud secrets create twilio-phone-number --data-file=- 2>$null
            if ($LASTEXITCODE -eq 0) { Write-Host "✅ Created" -ForegroundColor Green } else { Write-Host "⚠️  Already exists or error" -ForegroundColor Yellow }

            Write-Host ""
            Write-Host "⚠️  Note: Firebase service account secret must be created manually" -ForegroundColor Yellow
            Write-Host "See GOOGLE_CLOUD_DEPLOYMENT.md for instructions" -ForegroundColor Yellow
        } else {
            Write-Host "❌ .env.production file not found!" -ForegroundColor Red
        }
    }

    2 {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "Deploying to Google Cloud Run..." -ForegroundColor Yellow
        Write-Host "This may take 5-10 minutes..." -ForegroundColor Yellow
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
            --set-env-vars NODE_ENV=production,USE_FIRESTORE=true `
            --update-secrets OPENAI_API_KEY=openai-api-key:latest,TWILIO_ACCOUNT_SID=twilio-account-sid:latest,TWILIO_AUTH_TOKEN=twilio-auth-token:latest,TWILIO_PHONE_NUMBER=twilio-phone-number:latest,FIREBASE_SERVICE_ACCOUNT_JSON=firebase-service-account:latest

        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ Deployment successful!" -ForegroundColor Green
            Write-Host ""
            Write-Host "Next steps:" -ForegroundColor Yellow
            Write-Host "1. Copy the Service URL from above" -ForegroundColor White
            Write-Host "2. Update your Twilio webhooks with this URL" -ForegroundColor White
            Write-Host "3. Test your deployment" -ForegroundColor White
        } else {
            Write-Host ""
            Write-Host "❌ Deployment failed!" -ForegroundColor Red
            Write-Host "Check the error messages above" -ForegroundColor Yellow
        }
    }

    3 {
        Write-Host ""
        Write-Host "Fetching latest logs..." -ForegroundColor Yellow
        gcloud run logs read medical-ai-calling-system --region us-east1 --limit 50
    }

    4 {
        Write-Host ""
        Write-Host "Service Status:" -ForegroundColor Yellow
        gcloud run services describe medical-ai-calling-system --region us-east1
    }

    5 {
        Write-Host "Goodbye!" -ForegroundColor Green
        exit 0
    }

    default {
        Write-Host "Invalid choice" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
