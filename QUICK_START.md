# 🚀 Quick Start Guide

## You now have TWO systems:

### 1. **Inbound System** (Original) - Port 5050
People call YOUR number → AI answers
```bash
npm run start:inbound
# or
node index.js
```

### 2. **Outbound Medical System** (New) - Port 5051
YOUR system calls patients → AI conducts wellness checks
```bash
npm run start:outbound
# or
node outbound-medical.js
```

## 🏃 Starting the Medical Outbound System

### Step 1: Start the server
```bash
npm run start:outbound
```

### Step 2: Open the Dashboard
Open in browser: http://localhost:5051/patient-dashboard.html

### Step 3: Test with Sample Patients
Two test patients are already loaded:
- **John Smith**: Diabetes & Hypertension patient
- **Sarah Johnson**: Heart Failure patient

⚠️ **Note**: Sample patients have fake phone numbers. Update with real numbers to test.

### Step 4: Make a Test Call
1. Select a patient from the dashboard
2. Update their phone number to a real number
3. Click "📞 Call Now"
4. The system will call and conduct a wellness check!

## 📱 Key Differences

| Feature | Inbound System | Outbound Medical System |
|---------|---------------|-------------------------|
| **Direction** | Receives calls | Makes calls |
| **Port** | 5050 | 5051 |
| **Purpose** | General AI assistant | Medical wellness checks |
| **Customization** | Single prompt for all | Custom prompt per patient |
| **Management** | None | Full patient dashboard |
| **Scheduling** | No | Yes - recurring calls |
| **HIPAA** | Basic | Enhanced features |

## 🔧 Configuration

Your `.env` file is configured with:
- ✅ Twilio credentials
- ✅ OpenAI API key
- ✅ ngrok URL: https://f24d601f0eed.ngrok.app
- ✅ Port 5051 for medical system

## 📞 Making Your First Outbound Call

### Via Dashboard (Recommended)
1. Go to http://localhost:5051/patient-dashboard.html
2. Select "John Smith" or "Sarah Johnson"
3. Click "Call Now"

### Via API
```bash
curl -X POST http://localhost:5051/api/call \
  -H "Content-Type: application/json" \
  -d '{"patientId": "patient-001"}'
```

### Schedule a Call
```bash
curl -X POST http://localhost:5051/api/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "patient-001",
    "scheduledTime": "2025-09-25T10:00:00Z",
    "recurring": false
  }'
```

## 🏥 Medical Prompt Customization

Each patient gets personalized AI behavior. Edit `patients.json`:

```json
{
  "callObjectives": [
    "Check blood sugar levels",
    "Verify medication taken today",
    "Ask about any side effects",
    "Schedule follow-up if needed"
  ]
}
```

The AI will follow these objectives during the call!

## ⚡ Both Systems Can Run Simultaneously!

Terminal 1:
```bash
npm run start:inbound  # Receives calls on +18555291116
```

Terminal 2:
```bash
npm run start:outbound  # Makes calls FROM +18555291116
```

## 🔍 Monitoring

### View Audit Log
```bash
curl http://localhost:5051/api/audit
```

### Check Scheduled Calls
```bash
curl http://localhost:5051/api/schedule
```

### List All Patients
```bash
curl http://localhost:5051/api/patients
```

## 🚨 Important Notes

1. **Phone Numbers**: Update sample patient phone numbers before testing
2. **HIPAA**: This is a demo - add full compliance before production
3. **ngrok**: URL changes each restart - update BASE_URL in .env
4. **Costs**: Each call uses Twilio minutes + OpenAI API tokens

## 📝 Next Steps

1. **Add Real Patients**: Update `patients.json` with actual data
2. **Customize Prompts**: Modify AI behavior per condition
3. **Schedule Calls**: Set up recurring wellness checks
4. **Add Security**: Implement authentication before production
5. **Database**: Replace JSON file with secure database

## 🆘 Troubleshooting

**"Cannot make call"**
- Check phone number format (+1 prefix for US)
- Verify Twilio account has calling enabled
- Ensure ngrok URL is updated in .env

**"Patient not found"**
- Check patients.json exists
- Verify patient ID matches

**"WebSocket error"**
- Ensure OpenAI API key is valid
- Check Realtime API access enabled

---

Ready to revolutionize patient care with AI-powered wellness checks! 🎉