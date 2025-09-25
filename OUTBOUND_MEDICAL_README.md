# Medical Outbound Calling System

## 🏥 Overview

A HIPAA-conscious medical outbound calling system that enables healthcare providers to conduct automated wellness checks with patients using AI-powered voice conversations. Built with Twilio Voice, OpenAI Realtime API, and Node.js.

## ✨ Key Features

### Patient Management
- **Custom Patient Profiles**: Store patient information, conditions, medications, and call objectives
- **Personalized AI Prompts**: Each patient gets a customized conversation based on their medical context
- **Call History Tracking**: Complete audit trail of all patient interactions

### Automated Calling
- **Outbound Call Initiation**: Programmatically call patients for wellness checks
- **Schedule Calls**: Set up one-time or recurring calls (daily, weekly, monthly)
- **Real-time AI Conversation**: Natural voice interactions powered by OpenAI's Realtime API

### HIPAA Compliance Features
- **Audit Logging**: Complete audit trail of all system activities
- **Identity Verification**: AI verifies patient identity before discussing health information
- **Data Protection**: Sensitive data handling with encryption considerations
- **Consent Management**: Built-in consent verification workflows

### Dashboard
- **Web Interface**: User-friendly dashboard for managing patients and calls
- **Real-time Status**: Monitor call status and system activity
- **Call Scheduling**: Visual interface for scheduling patient calls

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Twilio Account with a phone number
- OpenAI API Key with Realtime API access
- ngrok (for local development)

### Installation

1. **Install dependencies**:
```bash
npm install
```

2. **Update .env file**:
```env
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1yournumber
OPENAI_API_KEY=your_openai_api_key
BASE_URL=https://your-ngrok-url.ngrok.app
```

3. **Start ngrok** (in a separate terminal):
```bash
ngrok http 5051
```

4. **Start the medical system**:
```bash
node outbound-medical.js
```

5. **Open the dashboard**:
```
http://localhost:5051/patient-dashboard.html
```

## 📁 File Structure

```
speech-assistant-openai-realtime-api-node/
├── outbound-medical.js      # Main server with outbound calling logic
├── patients.json            # Patient database (use secure DB in production)
├── patient-dashboard.html   # Web interface for management
├── index.js                # Original inbound calling system
└── .env                    # Environment configuration
```

## 🔧 Architecture

### System Components

1. **Patient Manager**
   - Handles CRUD operations for patient records
   - Generates personalized AI prompts per patient
   - Tracks call history and outcomes

2. **Call Scheduler**
   - Manages scheduled and recurring calls
   - Automatic execution at scheduled times
   - Support for daily/weekly/monthly patterns

3. **OpenAI Integration**
   - Real-time voice conversation handling
   - Context-aware responses based on patient data
   - Medical conversation guidelines

4. **Twilio Integration**
   - Outbound call initiation
   - Media stream handling
   - Call status tracking

## 📞 How It Works

### Outbound Call Flow

1. **Initiation**: System calls patient's phone number via Twilio
2. **Connection**: Establishes WebSocket connection with OpenAI Realtime API
3. **Verification**: AI verifies patient identity (DOB check)
4. **Conversation**: Conducts wellness check based on patient's medical context
5. **Documentation**: Records call transcript and important health information
6. **Follow-up**: Updates patient record with call outcomes

### API Endpoints

#### Patient Management
- `GET /api/patients` - List all patients
- `POST /api/patients` - Add new patient
- `PUT /api/patients/:id` - Update patient information

#### Call Operations
- `POST /api/call` - Initiate immediate call
- `POST /api/schedule` - Schedule future call
- `GET /api/schedule` - View scheduled calls

#### Monitoring
- `GET /api/audit` - View audit log

## 🏥 Medical Use Cases

### Wellness Checks
```javascript
{
  "callObjectives": [
    "Check medication adherence",
    "Monitor symptom changes",
    "Assess quality of life",
    "Schedule follow-up appointments"
  ]
}
```

### Chronic Disease Management
- Diabetes: Blood glucose monitoring, foot care reminders
- Heart Failure: Weight tracking, symptom assessment
- COPD: Breathing difficulty monitoring, inhaler technique
- Hypertension: Blood pressure checks, medication compliance

### Post-Discharge Follow-up
- Surgery recovery assessment
- Medication reconciliation
- Warning sign monitoring
- Appointment reminders

## 🔒 HIPAA Compliance Considerations

### Technical Safeguards
- **Encryption**: Use TLS for all communications
- **Access Control**: Implement user authentication (add before production)
- **Audit Controls**: Complete logging of all PHI access
- **Data Integrity**: Secure storage and transmission

### Administrative Requirements
- **Business Associate Agreement**: Required with Twilio
- **Staff Training**: Ensure proper PHI handling
- **Consent Management**: Obtain patient consent for calls
- **Minimum Necessary**: Only access required information

### Physical Safeguards
- **Workstation Security**: Secure access to dashboard
- **Device Controls**: Encrypted storage for patient data

## ⚠️ Important Security Notes

### Before Production Deployment

1. **Database Security**:
   - Replace `patients.json` with secure database (PostgreSQL/MongoDB)
   - Implement encryption at rest
   - Use connection pooling and SSL

2. **Authentication**:
   - Add authentication to all API endpoints
   - Implement role-based access control
   - Use OAuth2 or similar for dashboard access

3. **Data Encryption**:
   - Encrypt all PHI in transit and at rest
   - Use field-level encryption for sensitive data
   - Implement key management system

4. **Compliance**:
   - Conduct HIPAA risk assessment
   - Implement all required safeguards
   - Create policies and procedures
   - Train all staff on HIPAA requirements

5. **Monitoring**:
   - Set up real-time alerting for security events
   - Implement intrusion detection
   - Regular security audits

## 📊 Sample Patient Configuration

```json
{
  "name": "Jane Doe",
  "age": 75,
  "conditions": ["Type 2 Diabetes", "Hypertension"],
  "medications": ["Metformin 500mg", "Lisinopril 10mg"],
  "callObjectives": [
    "Check blood sugar levels",
    "Verify medication compliance",
    "Ask about diet and exercise",
    "Schedule next appointment if needed"
  ],
  "primaryConcern": "Diabetes management and blood pressure control"
}
```

## 🚦 Call Status Codes

- `scheduled` - Call is scheduled for future
- `executing` - Call is being placed
- `connected` - Patient answered, conversation active
- `completed` - Call finished successfully
- `failed` - Call could not be completed
- `no-answer` - Patient did not answer

## 🔄 Recurring Call Patterns

- **Daily**: For high-risk patients needing frequent monitoring
- **Weekly**: Standard chronic disease management
- **Monthly**: Stable patients with well-controlled conditions

## 📈 Monitoring & Analytics

The system provides:
- Call completion rates
- Average call duration
- Patient engagement metrics
- Health outcome tracking
- Medication adherence rates

## 🛠️ Troubleshooting

### Common Issues

1. **"Cannot connect to OpenAI"**
   - Verify OPENAI_API_KEY is correct
   - Ensure Realtime API access is enabled

2. **"Call fails immediately"**
   - Check Twilio phone number configuration
   - Verify ngrok URL is accessible
   - Ensure BASE_URL in .env matches ngrok URL

3. **"Patient not found"**
   - Check patients.json file exists
   - Verify patient ID format

4. **"WebSocket connection failed"**
   - Ensure ngrok is running
   - Check firewall settings
   - Verify port 5051 is available

## 📝 Development Tips

1. **Testing**: Use Twilio test credentials first
2. **Logging**: Enable verbose logging for debugging
3. **Prompts**: Test AI prompts thoroughly before production
4. **Compliance**: Always verify identity before PHI disclosure
5. **Monitoring**: Set up alerts for failed calls

## 🤝 Contributing

When contributing:
1. Follow HIPAA guidelines for any PHI handling
2. Add tests for new features
3. Update documentation
4. Follow secure coding practices

## ⚖️ Legal Disclaimer

This system is a demonstration of technical capabilities. Before using in production:
- Conduct full HIPAA compliance assessment
- Obtain legal review
- Implement all required safeguards
- Get appropriate insurance coverage
- Train all users on proper PHI handling

## 🔗 Resources

- [Twilio Voice Documentation](https://www.twilio.com/docs/voice)
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime)
- [HIPAA Compliance Guide](https://www.hhs.gov/hipaa/index.html)
- [Twilio HIPAA Compliance](https://www.twilio.com/hipaa)

## 📞 Support

For questions about:
- **Technical Implementation**: See documentation above
- **HIPAA Compliance**: Consult with healthcare compliance expert
- **Twilio Setup**: Contact Twilio support
- **OpenAI API**: Check OpenAI documentation

---

**Remember**: Healthcare communications require careful consideration of privacy, security, and compliance. Always prioritize patient safety and data protection.