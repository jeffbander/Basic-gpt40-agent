# Technical Specification: Medical Outbound Calling System with AI
## Complete Working Implementation Guide

---

## 🎯 System Overview

This system enables healthcare providers to make automated outbound calls to patients using Twilio Voice and OpenAI's Realtime API. The AI conducts personalized wellness checks based on each patient's medical profile.

### Core Capabilities
- **Outbound Calling**: System initiates calls to patients (not receiving calls)
- **Real-time AI Conversation**: Natural voice interaction using OpenAI's Realtime API
- **Patient-Specific Prompts**: Each patient has customized AI behavior
- **Call Recording & Transcripts**: Complete audit trail of all conversations
- **Medical Record Management**: MRN-based patient tracking with duplicate prevention

---

## 🏗️ Architecture Components

### 1. Technology Stack
```
Node.js (v18+) with ES Modules
├── Fastify (Web Server)
├── Twilio SDK (Voice Calling)
├── WebSocket (Real-time Communication)
├── OpenAI Realtime API (AI Voice)
└── ngrok (Local Development Tunnel)
```

### 2. Port Configuration
- **Port 5050**: Inbound calling system (original)
- **Port 5051**: Outbound medical system (V2)
- **Port 4040**: ngrok web interface

### 3. Data Flow Architecture
```
[Dashboard] → [Node.js Server:5051] → [Twilio API] → [Patient Phone]
                     ↓                        ↓
              [OpenAI Realtime API] ← [WebSocket Connection]
```

---

## 📞 Call Flow Technical Details

### Step 1: Call Initiation
```javascript
// Frontend triggers call
POST /api/call
{
  "patientId": "550e8400-e29b-41d4-a716-446655440001"
}

// Server processes request
1. Retrieves patient from database
2. Formats phone number to E.164 (+1XXXXXXXXXX)
3. Generates unique callId
4. Creates Twilio call with webhook URLs
```

### Step 2: Twilio Call Creation
```javascript
const call = await client.calls.create({
    from: TWILIO_PHONE_NUMBER,      // Your Twilio number
    to: formattedPhone,              // Patient's number
    url: `${BASE_URL}/outbound-twiml/${patient.id}?callId=${callId}`,
    statusCallback: `${BASE_URL}/call-status`,
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
});
```

### Step 3: TwiML Response (When Patient Answers)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Google.en-US-Chirp3-HD-Aoede">
        Hello, this is an automated wellness check from your healthcare provider.
    </Say>
    <Pause length="1"/>
    <Say voice="Google.en-US-Chirp3-HD-Aoede">Connecting you now.</Say>
    <Connect>
        <Stream url="wss://YOUR_NGROK_URL/media-stream/PATIENT_ID?callId=CALL_ID" />
    </Connect>
</Response>
```

### Step 4: WebSocket Connection Establishment
```javascript
// Two WebSocket connections are created:

// 1. Twilio → Your Server (Media Stream)
wss://your-server/media-stream/patientId

// 2. Your Server → OpenAI
wss://api.openai.com/v1/realtime?model=gpt-realtime&temperature=0.6
```

### Step 5: OpenAI Session Initialization
```javascript
const sessionUpdate = {
    type: 'session.update',
    session: {
        type: 'realtime',
        model: "gpt-realtime",
        output_modalities: ["audio"],
        audio: {
            input: {
                format: { type: 'audio/pcmu' },  // CRITICAL: Must be pcmu for Twilio
                turn_detection: { type: "server_vad" }
            },
            output: {
                format: { type: 'audio/pcmu' },  // CRITICAL: Must be pcmu for Twilio
                voice: 'alloy'
            },
        },
        instructions: patientManager.generateSystemPrompt(patient),
    },
};
```

### Step 6: Audio Stream Processing
```javascript
// Twilio → OpenAI (Patient Speaking)
connection.on('message', (message) => {
    const data = JSON.parse(message);
    if (data.event === 'media') {
        const audioAppend = {
            type: 'input_audio_buffer.append',
            audio: data.media.payload  // Base64 μ-law audio
        };
        openAiWs.send(JSON.stringify(audioAppend));
    }
});

// OpenAI → Twilio (AI Speaking)
openAiWs.on('message', (data) => {
    const response = JSON.parse(data);
    if (response.type === 'response.output_audio.delta') {
        const audioDelta = {
            event: 'media',
            streamSid: streamSid,
            media: { payload: response.delta }  // Base64 μ-law audio
        };
        connection.send(JSON.stringify(audioDelta));
    }
});
```

---

## 🔑 Critical Configuration Requirements

### 1. Environment Variables (.env)
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+18555291116  # Must be E.164 format
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
BASE_URL=https://YOUR-NGROK-SUBDOMAIN.ngrok.app  # MUST match ngrok URL
PORT=5051
```

### 2. ngrok Configuration
```bash
# CRITICAL: Must point to the SAME port as your server
ngrok http 5051

# This creates a public URL like:
# https://75d10d4f740d.ngrok.app → localhost:5051
```

**⚠️ CRITICAL POINT**: The ngrok URL changes every restart. You MUST:
1. Start ngrok first
2. Copy the new URL
3. Update BASE_URL in .env
4. Restart your Node.js server

### 3. Phone Number Format Handling
```javascript
// Auto-format to E.164 if not already formatted
let formattedPhone = patient.phoneNumber;
if (!formattedPhone.startsWith('+')) {
    if (formattedPhone.length === 10) {
        formattedPhone = `+1${formattedPhone}`;  // 6465565559 → +16465565559
    } else if (formattedPhone.length === 11 && formattedPhone.startsWith('1')) {
        formattedPhone = `+${formattedPhone}`;   // 16465565559 → +16465565559
    }
}
```

---

## 🗂️ File Structure

```
speech-assistant-openai-realtime-api-node/
├── outbound-medical-v2.js      # Main server (PORT 5051)
├── patient-dashboard-v2.html   # Web interface
├── patients-v2.json            # Patient database
├── call-transcripts.json       # Call recordings
├── .env                        # Configuration
└── package.json               # Dependencies & scripts
```

### Key Dependencies (package.json)
```json
{
  "dependencies": {
    "@fastify/formbody": "^8.0.0",
    "@fastify/static": "^8.2.0",
    "@fastify/websocket": "^11.0.0",
    "dotenv": "^16.4.5",
    "fastify": "^5.0.0",
    "twilio": "^5.9.0",
    "ws": "^8.18.0"
  },
  "scripts": {
    "start:medical": "node outbound-medical-v2.js"
  }
}
```

---

## 🚀 Startup Sequence (EXACT ORDER)

### 1. Install Dependencies
```bash
npm install
```

### 2. Start ngrok
```bash
ngrok http 5051
# Copy the HTTPS URL (e.g., https://75d10d4f740d.ngrok.app)
```

### 3. Configure Environment
Update `.env` file:
```env
BASE_URL=https://YOUR-NEW-NGROK-URL.ngrok.app
```

### 4. Start the Server
```bash
npm run start:medical
# Should output: "Medical Outbound Calling System V2 running on port 5051"
```

### 5. Access Dashboard
```
http://localhost:5051/patient-dashboard-v2.html
```

---

## 🏥 Patient Data Structure

### Patient Record (patients-v2.json)
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "mrn": "MRN-2025-001",              // Unique Medical Record Number
  "name": "John Smith",
  "phoneNumber": "6465565559",        // Can be with or without +1
  "age": 72,
  "gender": "male",
  "conditions": ["Type 2 Diabetes", "Hypertension"],
  "medications": ["Metformin 1000mg twice daily"],
  "primaryConcern": "Blood glucose monitoring",
  "customPrompt": "Custom AI instructions here...",  // Optional
  "callObjectives": [
    "Check blood glucose levels",
    "Verify medication compliance"
  ],
  "consentToRecord": true,
  "callHistory": []                   // Populated automatically
}
```

### AI Prompt Generation
```javascript
// If customPrompt exists, use it
// Otherwise, generate based on patient data:
const systemPrompt = `
You are a compassionate medical AI assistant conducting a wellness check.
You are speaking with ${patient.name}, a ${patient.age}-year-old ${patient.gender} patient.
MRN: ${patient.mrn}

Medical Context:
- Conditions: ${patient.conditions.join(', ')}
- Medications: ${patient.medications.join(', ')}

Call Objectives:
${patient.callObjectives.join('\n')}

Start by greeting the patient warmly and verifying their identity.
`;
```

---

## 🔧 Common Issues & Solutions

### Issue 1: "Application error has occurred" on call
**Cause**: Twilio can't reach your webhook URL
**Solution**:
1. Ensure ngrok is running on correct port (5051)
2. Update BASE_URL in .env with current ngrok URL
3. Restart Node.js server

### Issue 2: HTTP 11200 Error in Twilio Console
**Cause**: Webhook URL returning 404
**Solution**:
- Verify ngrok is forwarding to port 5051 (not 5050)
- Check server is running on port 5051

### Issue 3: No audio on call
**Cause**: Wrong audio format
**Solution**:
- Ensure audio format is set to 'audio/pcmu' for both input and output
- This is the only format Twilio supports

### Issue 4: Call connects but immediately disconnects
**Cause**: WebSocket connection failure
**Solution**:
- Check OpenAI API key is valid
- Ensure Realtime API access is enabled on your OpenAI account

---

## 📊 API Endpoints

### Patient Management
```
GET  /api/patients           # List all patients
GET  /api/patients/:id       # Get patient details
POST /api/patients           # Create new patient
PUT  /api/patients/:id       # Update patient
DELETE /api/patients/:id     # Delete patient
GET  /api/patients/mrn/:mrn  # Find by MRN
```

### Call Operations
```
POST /api/call               # Initiate outbound call
GET  /api/patients/:id/calls # Get call history
GET  /api/calls/:id/transcript # Get call transcript
```

### Webhooks (Called by Twilio)
```
GET  /outbound-twiml/:patientId  # TwiML for call instructions
POST /call-status                 # Call status updates
WebSocket /media-stream/:patientId # Audio streaming
```

---

## 🔒 Security Considerations

### HIPAA Compliance Features
1. **Audit Logging**: All actions logged with timestamps
2. **Identity Verification**: AI asks for DOB before discussing health info
3. **Consent Management**: Recording only with patient consent
4. **Data Encryption**: Use HTTPS/WSS for all communications

### Production Deployment
1. Replace JSON files with encrypted database
2. Add authentication to all endpoints
3. Implement rate limiting
4. Use environment-specific configuration
5. Enable Twilio security features (signature validation)

---

## 📝 Testing Checklist

- [ ] ngrok running on port 5051
- [ ] BASE_URL in .env matches ngrok URL
- [ ] Server shows "running on port 5051"
- [ ] Dashboard loads at http://localhost:5051/patient-dashboard-v2.html
- [ ] Can create/edit/delete patients
- [ ] Phone numbers auto-format correctly
- [ ] Calls connect successfully
- [ ] Audio works in both directions
- [ ] Transcripts are saved
- [ ] Call history displays correctly

---

## 🚨 CRITICAL SUCCESS FACTORS

1. **Audio Format MUST be pcmu**: OpenAI supports many formats, but Twilio ONLY works with μ-law (pcmu)

2. **ngrok URL Must Match**: The BASE_URL in .env MUST exactly match your current ngrok URL

3. **Port Consistency**: ngrok, server, and dashboard must all use port 5051

4. **WebSocket Protocol**: Must use wss:// (not ws://) for secure connections

5. **Phone Number Format**: Always E.164 format when calling Twilio API

---

## 💡 Quick Troubleshooting Commands

```bash
# Check if server is running
curl http://localhost:5051/

# Check ngrok URL
curl http://localhost:4040/api/tunnels

# Test API
curl http://localhost:5051/api/patients

# View logs
npm run start:medical

# Check Twilio webhook accessibility
curl https://YOUR-NGROK-URL.ngrok.app/
```

---

## 📦 Complete Working Configuration

This exact configuration is verified working:

```env
# .env file
TWILIO_ACCOUNT_SID=[YOUR_ACCOUNT_SID]
TWILIO_AUTH_TOKEN=[YOUR_AUTH_TOKEN]
TWILIO_PHONE_NUMBER=[YOUR_PHONE_NUMBER]
OPENAI_API_KEY=[YOUR_OPENAI_KEY]
BASE_URL=https://your-ngrok-url.ngrok.app
PORT=5051
```

```bash
# Terminal 1
ngrok http 5051

# Terminal 2
npm run start:medical

# Browser
http://localhost:5051/patient-dashboard-v2.html
```

---

## 📱 Contact for Issues

If the system stops working in future builds:
1. Check this document first
2. Verify all URLs and ports match
3. Ensure audio format is pcmu
4. Confirm ngrok is forwarding to correct port

This specification represents the EXACT working state as of 2025-09-25.