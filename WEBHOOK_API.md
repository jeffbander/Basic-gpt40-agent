# Webhook API Documentation

## Overview
The Medical Outbound Calling System supports webhook integration, allowing external agents and systems to trigger automated patient calls and receive transcripts.

## Endpoint: `/api/webhook/agent-trigger`

### Method: `POST`

### Description
Triggers an outbound call to a patient based on demographics parsed from the request. The system will:
1. Parse patient information from the PPD_demo field
2. Create or update the patient record
3. Initiate an AI-powered wellness check call
4. Return call status and transcript information

### Request Format

```json
{
    "call_objectives": [
        "Objective 1",
        "Objective 2"
    ],
    "Master_note": "Clinical context and notes",
    "PPD_demo": "Patient demographics in text format"
}
```

### Request Parameters

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `call_objectives` | Array | List of objectives for the AI to cover during the call | No |
| `Master_note` | String | Clinical context and notes for the AI to reference | No |
| `PPD_demo` | String | Patient demographics in text format (see format below) | Yes |

### PPD_demo Format

The PPD_demo field should contain patient information in the following text format:

```
Patient Name: LastName, FirstName
MRN: UNIQUE-IDENTIFIER
Date of Birth: MM/DD/YYYY
Phone: XXX-XXX-XXXX
Gender: Male/Female
Conditions: Condition1, Condition2, Condition3
Current Medications: Medication1, Medication2
```

### Supported Fields in PPD_demo

- **Patient Name**: Full name (Last, First format)
- **MRN**: Medical Record Number (unique identifier)
- **Date of Birth/DOB**: MM/DD/YYYY or YYYY-MM-DD format
- **Phone/Phone Number/Contact**: Phone number (will be auto-formatted)
- **Gender/Sex**: Male, Female, or Other
- **Conditions/Diagnoses/Medical History**: Comma-separated list
- **Medications/Current Medications**: Comma-separated list

### Response Format

#### Success Response (200 OK)

```json
{
    "success": true,
    "message": "Call initiated successfully",
    "patientId": "550e8400-e29b-41d4-a716-446655440001",
    "patientMRN": "TEST-2025-001",
    "callSid": "CA1234567890abcdef",
    "webhookCallId": "webhook-123e4567-e89b-12d3-a456-426614174000",
    "status": "Call initiated. Use the webhookCallId to check status.",
    "checkStatusUrl": "/api/webhook/status/webhook-123e4567-e89b-12d3-a456-426614174000",
    "estimatedDuration": "2-5 minutes"
}
```

#### Error Response (400/500)

```json
{
    "error": "Error message",
    "message": "Detailed error description",
    "parsed": {} // (Optional) Shows what was parsed from PPD_demo
}
```

## Status Check Endpoint: `/api/webhook/status/:webhookCallId`

### Method: `GET`

### Description
Check the status of a webhook-triggered call and retrieve the transcript when completed.

### Response Format

#### Call In Progress

```json
{
    "status": "in_progress",
    "callSid": "CA1234567890abcdef",
    "duration": "45 seconds",
    "message": "Call is still in progress"
}
```

#### Call Completed

```json
{
    "status": "completed",
    "transcript": {
        "patientId": "550e8400-e29b-41d4-a716-446655440001",
        "mrn": "TEST-2025-001",
        "patientName": "Cynthia Zacko",
        "conversation": [
            {
                "role": "assistant",
                "content": "Hello, this is an automated wellness check..."
            },
            {
                "role": "user",
                "content": "Yes, this is Cynthia."
            }
        ],
        "summary": {
            "totalExchanges": 10,
            "topics": ["medication compliance", "blood pressure"],
            "generatedAt": "2025-01-15T14:30:00Z"
        },
        "savedAt": "2025-01-15T14:35:00Z"
    }
}
```

## Example Usage

### Using cURL

```bash
# Trigger a call
curl -X POST http://localhost:5051/api/webhook/agent-trigger \
  -H "Content-Type: application/json" \
  -d '{
    "call_objectives": [
        "Check medication compliance",
        "Verify blood pressure readings"
    ],
    "Master_note": "Patient has hypertension, monitor for side effects",
    "PPD_demo": "Patient Name: Smith, John\nMRN: MRN-2025-100\nPhone: 555-123-4567\nDOB: 01/15/1950"
  }'

# Check status
curl http://localhost:5051/api/webhook/status/webhook-123e4567-e89b-12d3-a456-426614174000
```

### Using Node.js

```javascript
const response = await fetch('http://localhost:5051/api/webhook/agent-trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        call_objectives: ['Check symptoms', 'Medication review'],
        Master_note: 'Recent hospitalization for CHF',
        PPD_demo: 'Patient Name: Doe, Jane\nPhone: 555-987-6543'
    })
});

const result = await response.json();
console.log(result.checkStatusUrl); // Use this to check status
```

### Using Python

```python
import requests
import time

# Trigger call
response = requests.post(
    'http://localhost:5051/api/webhook/agent-trigger',
    json={
        'call_objectives': ['Wellness check'],
        'Master_note': 'Routine follow-up',
        'PPD_demo': 'Patient Name: Johnson, Mary\nPhone: 555-456-7890'
    }
)

result = response.json()
webhook_id = result['webhookCallId']

# Check status after waiting
time.sleep(60)
status = requests.get(f'http://localhost:5051/api/webhook/status/{webhook_id}')
print(status.json())
```

## Integration with External Systems

### AppSheet Integration

The webhook can be called from AppSheet using the "Call a webhook" task:

1. Set URL to: `https://your-domain.com/api/webhook/agent-trigger`
2. Set HTTP Method to: `POST`
3. Set Body to:
```json
{
    "call_objectives": [<<[CallObjectives]>>],
    "Master_note": "<<[MasterNote]>>",
    "PPD_demo": "<<[PatientDemographics]>>"
}
```

### Zapier/Make/n8n Integration

Configure HTTP Request module with:
- URL: Your webhook endpoint
- Method: POST
- Headers: `Content-Type: application/json`
- Body: JSON with required fields

## Testing

Use the provided test script:

```bash
node test-webhook.js
```

This will send a test patient call request and check the status.

## Security Considerations

⚠️ **Important**: In production environments:

1. **Authentication**: Add API key or OAuth authentication
2. **HTTPS**: Always use HTTPS for webhook endpoints
3. **Rate Limiting**: Implement rate limiting to prevent abuse
4. **Validation**: Validate phone numbers and patient data
5. **HIPAA Compliance**: Ensure all PHI is encrypted in transit and at rest
6. **Audit Logging**: Log all webhook calls for compliance

## Error Handling

The webhook handles various error conditions:

- **Missing Phone Number**: Returns 400 with parsed data
- **Invalid Patient Data**: Creates patient with available data
- **Twilio Errors**: Returns 500 with error details
- **Timeout**: Calls timeout after 5 minutes

## Limitations

- Maximum call duration: 5 minutes
- Phone numbers must be valid US numbers
- Concurrent webhook calls are limited by Twilio account limits
- Transcripts are stored for 30 days by default