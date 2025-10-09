import Fastify from 'fastify';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import twilio from 'twilio';
import { promises as fs } from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const { OPENAI_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;

if (!OPENAI_API_KEY || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.error('Missing required environment variables.');
    process.exit(1);
}

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

const fastify = Fastify();
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);
fastify.register(fastifyStatic, {
    root: __dirname,
    prefix: '/'
});

// Constants
const PORT = process.env.PORT || 5051;
const VOICE = 'alloy';
const TEMPERATURE = 0.6;

// Enhanced Patient Manager with MRN and Call Transcripts
class PatientManager {
    constructor() {
        this.patients = new Map();
        this.mrnIndex = new Map(); // MRN to patient ID mapping
        this.callSessions = new Map();
        this.callTranscripts = new Map(); // Store full transcripts
        // loadData() is called async in startServer()
    }

    async loadData() {
        // Load patients
        try {
            const data = await fs.readFile('patients-v2.json', 'utf8');
            const patientsData = JSON.parse(data);
            patientsData.patients.forEach(patient => {
                this.patients.set(patient.id, patient);
                if (patient.mrn) {
                    this.mrnIndex.set(patient.mrn, patient.id);
                }
            });
            console.log(`Loaded ${this.patients.size} patients`);
        } catch (error) {
            console.log('Creating new patient database');
            this.saveData();
        }

        // Load call transcripts
        try {
            const transcriptData = await fs.readFile('call-transcripts.json', 'utf8');
            const transcripts = JSON.parse(transcriptData);
            Object.entries(transcripts).forEach(([callId, transcript]) => {
                this.callTranscripts.set(callId, transcript);
            });
            console.log(`Loaded ${this.callTranscripts.size} call transcripts`);
        } catch (error) {
            console.log('No call transcripts found');
        }
    }

    async saveData() {
        const patientsData = {
            patients: Array.from(this.patients.values()),
            lastUpdated: new Date().toISOString()
        };
        await fs.writeFile('patients-v2.json', JSON.stringify(patientsData, null, 2));
    }

    async saveTranscripts() {
        const transcripts = Object.fromEntries(this.callTranscripts);
        await fs.writeFile('call-transcripts.json', JSON.stringify(transcripts, null, 2));
    }

    validateMRN(mrn, excludePatientId = null) {
        const existingPatientId = this.mrnIndex.get(mrn);
        if (existingPatientId && existingPatientId !== excludePatientId) {
            return { valid: false, message: `MRN ${mrn} already exists for another patient` };
        }
        return { valid: true };
    }

    addPatient(patientData) {
        // Validate MRN
        if (patientData.mrn) {
            const mrnValidation = this.validateMRN(patientData.mrn);
            if (!mrnValidation.valid) {
                throw new Error(mrnValidation.message);
            }
        }

        const id = crypto.randomUUID();
        const newPatient = {
            id,
            mrn: patientData.mrn || `AUTO-${Date.now()}`,
            ...patientData,
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            lastContact: null,
            callHistory: [],
            customPrompt: patientData.customPrompt || this.getDefaultPrompt(patientData),
            callObjectives: patientData.callObjectives || []
        };

        this.patients.set(id, newPatient);
        this.mrnIndex.set(newPatient.mrn, id);
        this.saveData();
        return newPatient;
    }

    updatePatient(id, updates) {
        const patient = this.patients.get(id);
        if (!patient) return null;

        // Validate MRN if being updated
        if (updates.mrn && updates.mrn !== patient.mrn) {
            const mrnValidation = this.validateMRN(updates.mrn, id);
            if (!mrnValidation.valid) {
                throw new Error(mrnValidation.message);
            }
            // Update MRN index
            this.mrnIndex.delete(patient.mrn);
            this.mrnIndex.set(updates.mrn, id);
        }

        const updatedPatient = {
            ...patient,
            ...updates,
            lastModified: new Date().toISOString()
        };
        this.patients.set(id, updatedPatient);
        this.saveData();
        return updatedPatient;
    }

    deletePatient(id) {
        const patient = this.patients.get(id);
        if (!patient) return false;

        // Remove from MRN index
        if (patient.mrn) {
            this.mrnIndex.delete(patient.mrn);
        }

        // Archive call history before deletion (optional)
        if (patient.callHistory.length > 0) {
            this.archivePatientCalls(patient);
        }

        this.patients.delete(id);
        this.saveData();
        return true;
    }

    async archivePatientCalls(patient) {
        const archiveData = {
            patient: {
                id: patient.id,
                mrn: patient.mrn,
                name: patient.name
            },
            archivedAt: new Date().toISOString(),
            callHistory: patient.callHistory,
            transcripts: patient.callHistory.map(call =>
                this.callTranscripts.get(call.callId)
            ).filter(Boolean)
        };

        try {
            const existingArchive = await fs.readFile('archived-patients.json', 'utf8')
                .then(data => JSON.parse(data))
                .catch(() => []);

            existingArchive.push(archiveData);
            await fs.writeFile('archived-patients.json', JSON.stringify(existingArchive, null, 2));
        } catch (error) {
            console.error('Error archiving patient data:', error);
        }
    }

    getPatient(id) {
        return this.patients.get(id);
    }

    getPatientByMRN(mrn) {
        const id = this.mrnIndex.get(mrn);
        return id ? this.patients.get(id) : null;
    }

    getAllPatients() {
        return Array.from(this.patients.values());
    }

    getDefaultPrompt(patient) {
        return `You are a compassionate medical AI assistant conducting a wellness check.
        Be empathetic, speak clearly, and document important health information.
        Ask about symptoms, medication adherence, and overall wellbeing.
        If emergency symptoms are mentioned, advise calling 911.`;
    }

    generateSystemPrompt(patient) {
        // Use custom prompt if available, otherwise generate based on patient data
        if (patient.customPrompt) {
            return patient.customPrompt;
        }

        const basePrompt = `You are a compassionate and professional medical AI assistant conducting a wellness check call.
        You are speaking with ${patient.name}, a ${patient.age}-year-old ${patient.gender} patient.
        MRN: ${patient.mrn}

        Medical Context:
        - Conditions: ${patient.conditions?.join(', ') || 'None specified'}
        - Medications: ${patient.medications?.join(', ') || 'None specified'}
        - Last appointment: ${patient.lastAppointment || 'Not specified'}
        - Primary concern: ${patient.primaryConcern || 'General wellness'}

        Call Objectives:
        ${patient.callObjectives?.join('\n') || 'General wellness check'}

        Guidelines:
        1. Be empathetic and patient-focused
        2. Speak clearly and at a moderate pace
        3. Ask open-ended questions about their health
        4. Listen for any concerning symptoms
        5. Remind about medication adherence if applicable
        6. Document any important health information
        7. If emergency symptoms are mentioned, advise calling 911
        8. Maintain HIPAA compliance - verify identity before discussing health information

        Start by greeting the patient warmly and verifying their identity with their date of birth.`;

        return basePrompt;
    }

    recordCallSession(patientId, sessionData) {
        const patient = this.patients.get(patientId);
        if (!patient) return;

        const callRecord = {
            callId: sessionData.callId || crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            ...sessionData
        };

        patient.callHistory.push(callRecord);
        patient.lastContact = new Date().toISOString();

        // Save transcript separately for efficient storage
        if (sessionData.transcript) {
            this.callTranscripts.set(callRecord.callId, {
                patientId,
                mrn: patient.mrn,
                patientName: patient.name,
                ...sessionData.transcript,
                savedAt: new Date().toISOString()
            });
            this.saveTranscripts();
        }

        this.saveData();
        return callRecord.callId;
    }

    getCallHistory(patientId) {
        const patient = this.patients.get(patientId);
        if (!patient) return [];

        return patient.callHistory.map(call => ({
            ...call,
            transcript: this.callTranscripts.get(call.callId)
        }));
    }

    getCallTranscript(callId) {
        return this.callTranscripts.get(callId);
    }
}

const patientManager = new PatientManager();

// Call Recording Configuration
const ENABLE_RECORDING = process.env.ENABLE_RECORDING === 'true';

// Audit logging
const auditLog = [];
const logAuditEvent = (event, details) => {
    const entry = {
        timestamp: new Date().toISOString(),
        event,
        ...details,
        sessionId: crypto.randomUUID()
    };
    auditLog.push(entry);
    console.log('[AUDIT]', entry);
};

// PPD Demo Parser Function
function parsePPDDemo(ppdDemoText) {
    const parsed = {
        name: '',
        mrn: '',
        dateOfBirth: '',
        phoneNumber: '',
        gender: '',
        conditions: [],
        medications: []
    };

    if (!ppdDemoText) return parsed;

    console.log('[PPD_DEMO] Parsing:', ppdDemoText);

    // Enhanced Patient Name parsing - handles "Santiago, Yuki" format
    const namePatterns = [
        /Patient Name:\s*([^\n]+)/i,
        /Name:\s*([^\n]+)/i,
        /Patient:\s*([^\n]+)/i
    ];

    for (const pattern of namePatterns) {
        const nameMatch = ppdDemoText.match(pattern);
        if (nameMatch) {
            parsed.name = nameMatch[1].trim();
            break;
        }
    }

    // Enhanced MRN parsing - handles "Mount Sinai MRN", "Patient Mount Sinai MRN", etc.
    const mrnPatterns = [
        /(?:Patient )?(?:Mount Sinai )?MRN:\s*([^\n]+)/i,
        /MRN:\s*([^\n]+)/i,
        /Medical Record Number:\s*([^\n]+)/i,
        /Chart #:\s*([^\n]+)/i
    ];

    for (const pattern of mrnPatterns) {
        const mrnMatch = ppdDemoText.match(pattern);
        if (mrnMatch) {
            parsed.mrn = mrnMatch[1].trim();
            break;
        }
    }

    // Enhanced Date of Birth parsing - handles MM/DD/YY and MM/DD/YYYY
    const dobPatterns = [
        /(?:Date of Birth|DOB):\s*([^\n]+)/i,
        /Birth Date:\s*([^\n]+)/i,
        /Birthday:\s*([^\n]+)/i
    ];

    for (const pattern of dobPatterns) {
        const dobMatch = ppdDemoText.match(pattern);
        if (dobMatch) {
            const dobStr = dobMatch[1].trim();
            // Try to parse date in various formats
            const dateFormats = [
                /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // MM/DD/YYYY
                /(\d{1,2})\/(\d{1,2})\/(\d{2})/, // MM/DD/YY
                /(\d{4})-(\d{2})-(\d{2})/,       // YYYY-MM-DD
            ];

            for (const format of dateFormats) {
                const match = dobStr.match(format);
                if (match) {
                    if (format === dateFormats[0]) {
                        // MM/DD/YYYY
                        parsed.dateOfBirth = `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
                    } else if (format === dateFormats[1]) {
                        // MM/DD/YY - assume 20XX for XX < 30, 19XX for XX >= 30
                        const year = parseInt(match[3]);
                        const fullYear = year < 30 ? 2000 + year : 1900 + year;
                        parsed.dateOfBirth = `${fullYear}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
                    } else {
                        // YYYY-MM-DD
                        parsed.dateOfBirth = match[0];
                    }
                    break;
                }
            }
            break;
        }
    }

    // Enhanced Phone Number parsing - handles "Cell Phone", "Mobile", etc.
    const phonePatterns = [
        /(?:Cell Phone|Mobile Phone|Cell|Mobile):\s*([^\n]+)/i,
        /(?:Phone|Phone Number|Contact|Telephone|Tel):\s*([^\n]+)/i,
        /(?:Primary Phone|Home Phone):\s*([^\n]+)/i
    ];

    for (const pattern of phonePatterns) {
        const phoneMatch = ppdDemoText.match(pattern);
        if (phoneMatch) {
            parsed.phoneNumber = phoneMatch[1].trim();
            break;
        }
    }

    // Parse Gender
    const genderMatch = ppdDemoText.match(/(?:Gender|Sex):\s*([^\n]+)/i);
    if (genderMatch) {
        const gender = genderMatch[1].trim().toLowerCase();
        parsed.gender = gender.startsWith('m') ? 'male' : gender.startsWith('f') ? 'female' : 'other';
    }

    console.log('[PPD_DEMO] Parsed result:', parsed);
    return parsed;
}

// Enhanced Agent Data Parser for complex webhook formats
class AgentDataParser {
    constructor() {
        // Define field mapping patterns for different agent systems
        this.fieldMappings = {
            // Patient Name variations
            name: [
                'patient_name', 'patientName', 'full_name', 'fullName', 'name',
                'firstName', 'first_name', 'lastName', 'last_name',
                'patient.name', 'client_name', 'clientName'
            ],
            // Phone Number variations
            phone: [
                'phone', 'phoneNumber', 'phone_number', 'mobile', 'mobile_phone',
                'cell', 'cell_phone', 'contact_number', 'primary_phone',
                'patient.phone', 'contact.phone', 'telephone', 'tel'
            ],
            // Medical Record Number variations
            mrn: [
                'mrn', 'MRN', 'medical_record_number', 'medicalRecordNumber',
                'patient_id', 'patientId', 'chart_number', 'chartNumber',
                'record_id', 'recordId', 'patient.mrn'
            ],
            // Date of Birth variations
            dob: [
                'dob', 'DOB', 'date_of_birth', 'dateOfBirth', 'birth_date',
                'birthDate', 'patient.dob', 'birthday'
            ],
            // Gender variations
            gender: [
                'gender', 'sex', 'patient.gender', 'patient_gender'
            ],
            // Call objectives variations
            objectives: [
                'call_objectives', 'callObjectives', 'objectives', 'goals',
                'call_goals', 'purpose', 'reasons', 'agenda'
            ],
            // Clinical notes variations
            notes: [
                'Master_note', 'master_note', 'clinical_notes', 'notes',
                'patient_notes', 'medical_history', 'history', 'background'
            ]
        };

        // Phone number cleaning patterns
        this.phonePatterns = [
            /^\+?1?[-.\s]?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/,
            /^\+?([1-9]\d{0,3})[-.\s]?\(?([0-9]{1,4})\)?[-.\s]?([0-9]{1,4})[-.\s]?([0-9]{1,9})$/
        ];
    }

    // Extract nested field values using dot notation
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : null;
        }, obj);
    }

    // Smart field mapping with fallbacks
    extractField(data, fieldType) {
        const mappings = this.fieldMappings[fieldType] || [];

        for (const mapping of mappings) {
            let value = null;

            // Try direct field access
            if (data[mapping] !== undefined) {
                value = data[mapping];
            }
            // Try nested field access (e.g., patient.name)
            else if (mapping.includes('.')) {
                value = this.getNestedValue(data, mapping);
            }

            if (value !== null && value !== undefined && value !== '') {
                // Handle arrays (take first element)
                if (Array.isArray(value)) {
                    value = value.length > 0 ? value[0] : null;
                }

                // Convert to string and trim
                if (typeof value === 'object') {
                    // For complex objects, try to extract meaningful text
                    if (value.text) value = value.text;
                    else if (value.content) value = value.content;
                    else if (value.value) value = value.value;
                    else value = JSON.stringify(value);
                }

                return String(value).trim();
            }
        }

        return null;
    }

    // Clean and validate phone numbers
    cleanPhoneNumber(phone) {
        if (!phone) return null;

        // Remove all non-digit characters except +
        const cleaned = phone.replace(/[^\d+]/g, '');

        // Try to match common patterns
        for (const pattern of this.phonePatterns) {
            const match = phone.match(pattern);
            if (match) {
                // US number format
                if (match[1] && match[2] && match[3]) {
                    return `+1${match[1]}${match[2]}${match[3]}`;
                }
            }
        }

        // Fallback: if it looks like a 10-digit US number
        if (/^\d{10}$/.test(cleaned)) {
            return `+1${cleaned}`;
        }

        // If it starts with +, keep as is
        if (cleaned.startsWith('+') && cleaned.length > 5) {
            return cleaned;
        }

        return phone; // Return original if we can't parse it
    }

    // Parse date formats
    parseDate(dateStr) {
        if (!dateStr) return null;

        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
        }

        // Try common formats
        const formats = [
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // MM/DD/YYYY
            /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // MM-DD-YYYY
            /^(\d{4})-(\d{1,2})-(\d{1,2})$/, // YYYY-MM-DD
        ];

        for (const format of formats) {
            const match = dateStr.match(format);
            if (match) {
                if (format === formats[2]) { // YYYY-MM-DD
                    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
                } else { // MM/DD/YYYY or MM-DD-YYYY
                    return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
                }
            }
        }

        return dateStr; // Return original if we can't parse it
    }

    // Main parsing function
    parseAgentData(webhookData) {
        console.log('[AGENT_PARSER] Processing webhook data:', JSON.stringify(webhookData, null, 2));

        const parsed = {
            name: null,
            phoneNumber: null,
            mrn: null,
            dob: null,
            gender: null,
            objectives: [],
            notes: null,
            rawData: webhookData
        };

        // Extract basic fields
        parsed.name = this.extractField(webhookData, 'name');
        parsed.mrn = this.extractField(webhookData, 'mrn');
        parsed.gender = this.extractField(webhookData, 'gender');
        parsed.notes = this.extractField(webhookData, 'notes');

        // Handle phone number with cleaning
        const rawPhone = this.extractField(webhookData, 'phone');
        parsed.phoneNumber = this.cleanPhoneNumber(rawPhone);

        // Handle date of birth with parsing
        const rawDob = this.extractField(webhookData, 'dob');
        parsed.dob = this.parseDate(rawDob);

        // Handle objectives (can be array or string)
        const objectives = this.extractField(webhookData, 'objectives');
        if (objectives) {
            if (Array.isArray(objectives)) {
                parsed.objectives = objectives.map(obj => String(obj).trim()).filter(obj => obj);
            } else if (typeof objectives === 'string') {
                // Split by common delimiters
                parsed.objectives = objectives.split(/[,;|\n]/).map(obj => obj.trim()).filter(obj => obj);
            }
        }

        // Try to parse PPD_demo if present (check both PPD_demo and PPD_Demo)
        const ppdField = webhookData.PPD_demo || webhookData.PPD_Demo;
        if (ppdField) {
            try {
                const ppdParsed = parsePPDDemo(ppdField);
                // Merge PPD_demo data as fallback
                if (!parsed.name && ppdParsed.name) parsed.name = ppdParsed.name;
                if (!parsed.phoneNumber && ppdParsed.phoneNumber) parsed.phoneNumber = ppdParsed.phoneNumber;
                if (!parsed.mrn && ppdParsed.mrn) parsed.mrn = ppdParsed.mrn;
                if (!parsed.dob && ppdParsed.dob) parsed.dob = ppdParsed.dob;
                if (!parsed.gender && ppdParsed.gender) parsed.gender = ppdParsed.gender;
            } catch (error) {
                console.warn('[AGENT_PARSER] Failed to parse PPD_demo:', error.message);
            }
        }

        // Validation and cleanup
        if (!parsed.name) {
            console.warn('[AGENT_PARSER] No patient name found in webhook data');
        }

        if (!parsed.phoneNumber) {
            console.warn('[AGENT_PARSER] No valid phone number found in webhook data');
        }

        console.log('[AGENT_PARSER] Parsed result:', parsed);
        return parsed;
    }

    // Generate parsing report for debugging
    generateParsingReport(webhookData, parsed) {
        const report = {
            timestamp: new Date().toISOString(),
            success: !!(parsed.name && parsed.phoneNumber),
            fieldsFound: {},
            fieldsMissing: [],
            warnings: []
        };

        // Check which fields were successfully extracted
        Object.keys(this.fieldMappings).forEach(fieldType => {
            const value = parsed[fieldType === 'phone' ? 'phoneNumber' : fieldType];
            if (value) {
                report.fieldsFound[fieldType] = value;
            } else {
                report.fieldsMissing.push(fieldType);
            }
        });

        // Add warnings
        if (!parsed.name) report.warnings.push('No patient name found');
        if (!parsed.phoneNumber) report.warnings.push('No valid phone number found');
        if (!parsed.mrn) report.warnings.push('No MRN found - will generate random ID');

        return report;
    }
}

// Create global parser instance
const agentParser = new AgentDataParser();

// Store active webhook calls to track completion
const activeWebhookCalls = new Map();

// Outbound Call Function with Recording
async function makeOutboundCall(patient) {
    if (!patient.phoneNumber) {
        throw new Error(`No phone number for patient ${patient.mrn}`);
    }

    // Format phone number to E.164 if needed
    let formattedPhone = patient.phoneNumber;
    if (!formattedPhone.startsWith('+')) {
        // Assume US number if no country code
        if (formattedPhone.length === 10) {
            formattedPhone = `+1${formattedPhone}`;
        } else if (formattedPhone.length === 11 && formattedPhone.startsWith('1')) {
            formattedPhone = `+${formattedPhone}`;
        }
    }

    const callId = crypto.randomUUID();
    const baseUrl = process.env.BASE_URL || `https://${process.env.NGROK_URL}`;

    logAuditEvent('OUTBOUND_CALL_INITIATED', {
        patientId: patient.id,
        mrn: patient.mrn,
        callId
    });

    try {
        const callOptions = {
            from: TWILIO_PHONE_NUMBER,
            to: formattedPhone,
            url: `${baseUrl}/outbound-twiml/${patient.id}?callId=${callId}`,
            statusCallback: `${baseUrl}/call-status`,
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
        };

        // Add recording if enabled and consent is given
        if (ENABLE_RECORDING && patient.consentToRecord) {
            callOptions.record = true;
            callOptions.recordingStatusCallback = `${baseUrl}/recording-status`;
        }

        const call = await client.calls.create(callOptions);

        console.log(`Call initiated to patient ${patient.name} (MRN: ${patient.mrn}): ${call.sid}`);
        patientManager.callSessions.set(call.sid, { patientId: patient.id, callId });

        return { callSid: call.sid, callId };
    } catch (error) {
        console.error('Error making outbound call:', error);
        logAuditEvent('OUTBOUND_CALL_FAILED', {
            patientId: patient.id,
            mrn: patient.mrn,
            error: error.message
        });
        throw error;
    }
}

// Routes
fastify.get('/', async (request, reply) => {
    reply.send({
        message: 'Medical Outbound Calling System V2',
        version: '2.0.0',
        features: [
            'MRN management with duplicate prevention',
            'Full CRUD operations for patients',
            'Custom prompt editing per patient',
            'Call recording and transcripts',
            'Complete call history',
            'Enhanced UI/UX'
        ]
    });
});

// API Routes - Patients
fastify.get('/api/patients', async (request, reply) => {
    const patients = patientManager.getAllPatients();
    reply.send(patients.map(p => ({
        ...p,
        phoneNumber: p.phoneNumber ? `***-***-${p.phoneNumber.slice(-4)}` : null,
        callCount: p.callHistory?.length || 0
    })));
});

fastify.get('/api/patients/:id', async (request, reply) => {
    const patient = patientManager.getPatient(request.params.id);
    if (!patient) {
        reply.status(404).send({ error: 'Patient not found' });
        return;
    }
    reply.send(patient);
});

fastify.post('/api/patients', async (request, reply) => {
    try {
        const patient = patientManager.addPatient(request.body);
        logAuditEvent('PATIENT_CREATED', { patientId: patient.id, mrn: patient.mrn });
        reply.send(patient);
    } catch (error) {
        reply.status(400).send({ error: error.message });
    }
});

fastify.put('/api/patients/:id', async (request, reply) => {
    try {
        const patient = patientManager.updatePatient(request.params.id, request.body);
        if (!patient) {
            reply.status(404).send({ error: 'Patient not found' });
            return;
        }
        logAuditEvent('PATIENT_UPDATED', { patientId: patient.id, mrn: patient.mrn });
        reply.send(patient);
    } catch (error) {
        reply.status(400).send({ error: error.message });
    }
});

fastify.delete('/api/patients/:id', async (request, reply) => {
    const deleted = patientManager.deletePatient(request.params.id);
    if (!deleted) {
        reply.status(404).send({ error: 'Patient not found' });
        return;
    }
    logAuditEvent('PATIENT_DELETED', { patientId: request.params.id });
    reply.send({ success: true });
});

// Get patient by MRN
fastify.get('/api/patients/mrn/:mrn', async (request, reply) => {
    const patient = patientManager.getPatientByMRN(request.params.mrn);
    if (!patient) {
        reply.status(404).send({ error: 'Patient not found with this MRN' });
        return;
    }
    reply.send(patient);
});

// Call History
fastify.get('/api/patients/:id/calls', async (request, reply) => {
    const history = patientManager.getCallHistory(request.params.id);
    reply.send(history);
});

fastify.get('/api/calls/:callId/transcript', async (request, reply) => {
    const transcript = patientManager.getCallTranscript(request.params.callId);
    if (!transcript) {
        reply.status(404).send({ error: 'Transcript not found' });
        return;
    }
    reply.send(transcript);
});

// Initiate Call
fastify.post('/api/call', async (request, reply) => {
    const { patientId } = request.body;
    const patient = patientManager.getPatient(patientId);

    if (!patient) {
        reply.status(404).send({ error: 'Patient not found' });
        return;
    }

    try {
        const result = await makeOutboundCall(patient);
        reply.send({ success: true, ...result });
    } catch (error) {
        reply.status(500).send({ error: error.message });
    }
});

// TwiML for outbound calls
fastify.all('/outbound-twiml/:patientId', async (request, reply) => {
    const { patientId } = request.params;
    const { callId } = request.query;
    const patient = patientManager.getPatient(patientId);

    if (!patient) {
        reply.status(404).send('Patient not found');
        return;
    }

    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
            <Say voice="Google.en-US-Chirp3-HD-Aoede">Hello, this is an automated wellness check from your healthcare provider.</Say>
            <Pause length="1"/>
            <Say voice="Google.en-US-Chirp3-HD-Aoede">Connecting you now.</Say>
            <Connect>
                <Stream url="wss://${request.headers.host}/media-stream/${patientId}?callId=${callId}" />
            </Connect>
        </Response>`;

    reply.type('text/xml').send(twimlResponse);
});

// Enhanced Real-Time Transcription System with Production Error Logging
class TranscriptionManager {
    constructor(callId, patientId, patient) {
        this.callId = callId;
        this.patientId = patientId;
        this.patient = patient;
        this.startTime = Date.now();

        // Dual transcription pipelines
        this.realtimeTranscript = [];
        this.conversationItems = new Map(); // item_id -> conversation item
        this.audioTranscriptions = new Map(); // item_id -> transcription
        this.responseTranscripts = new Map(); // response_id -> AI response

        // State management
        this.eventSequence = 0;
        this.lastAudioTranscriptionTime = null;
        this.lastResponseTime = null;
        this.errorLog = [];
        this.performanceMetrics = {
            totalEvents: 0,
            transcriptionEvents: 0,
            responseEvents: 0,
            errorCount: 0,
            avgProcessingTime: 0
        };

        // Audio buffer for fallback transcription
        this.audioBuffer = [];
        this.bufferMaxSize = 10 * 1024 * 1024; // 10MB buffer

        console.log(`[TRANSCRIPTION] Initialized for call ${callId}, patient ${patient.name}`);
    }

    logError(context, error, eventData = {}) {
        const errorEntry = {
            timestamp: new Date().toISOString(),
            sequence: this.eventSequence++,
            context,
            error: error.message || error,
            stack: error.stack,
            eventData,
            callState: {
                callId: this.callId,
                patientId: this.patientId,
                patientMRN: this.patient.mrn,
                callDuration: Date.now() - this.startTime,
                transcriptLength: this.realtimeTranscript.length,
                lastTranscriptionTime: this.lastAudioTranscriptionTime,
                lastResponseTime: this.lastResponseTime
            },
            aiDebuggingPrompt: this.generateAIDebuggingPrompt(context, error, eventData)
        };

        this.errorLog.push(errorEntry);
        this.performanceMetrics.errorCount++;

        console.error(`[TRANSCRIPTION_ERROR] ${context}:`, errorEntry);

        // Log to audit system
        logAuditEvent('TRANSCRIPTION_ERROR', {
            patientId: this.patientId,
            callId: this.callId,
            error: context,
            details: errorEntry
        });
    }

    generateAIDebuggingPrompt(context, error, eventData) {
        return `TRANSCRIPTION DEBUG REQUEST:

Context: ${context}
Error: ${error.message || error}
Call ID: ${this.callId}
Patient: ${this.patient.name} (MRN: ${this.patient.mrn})
Call Duration: ${Date.now() - this.startTime}ms

Current State:
- Transcript Length: ${this.realtimeTranscript.length}
- Conversation Items: ${this.conversationItems.size}
- Audio Transcriptions: ${this.audioTranscriptions.size}
- Response Transcripts: ${this.responseTranscripts.size}
- Last Audio Transcription: ${this.lastAudioTranscriptionTime}
- Last Response: ${this.lastResponseTime}

Event Data: ${JSON.stringify(eventData, null, 2)}

Recent Transcript: ${JSON.stringify(this.realtimeTranscript.slice(-5), null, 2)}

Please analyze this transcription error and provide specific fixes for the audio pipeline issue.`;
    }

    bufferAudio(audioData) {
        if (this.audioBuffer.length > this.bufferMaxSize) {
            this.audioBuffer = this.audioBuffer.slice(-this.bufferMaxSize / 2); // Keep last half
        }
        this.audioBuffer.push({
            timestamp: Date.now(),
            data: audioData
        });
    }

    processConversationItem(item) {
        try {
            this.performanceMetrics.totalEvents++;

            if (item.id) {
                this.conversationItems.set(item.id, {
                    ...item,
                    receivedAt: Date.now()
                });

                // Add to real-time transcript immediately if it has content
                if (item.role && item.content) {
                    this.addToTranscript({
                        role: item.role,
                        content: item.content,
                        timestamp: new Date().toISOString(),
                        source: 'conversation_item',
                        itemId: item.id
                    });
                }
            }

            console.log(`[TRANSCRIPTION] Conversation item processed: ${item.role || 'unknown'} (ID: ${item.id})`);
        } catch (error) {
            this.logError('processConversationItem', error, { item });
        }
    }

    processAudioTranscription(transcription) {
        try {
            this.performanceMetrics.totalEvents++;
            this.performanceMetrics.transcriptionEvents++;
            this.lastAudioTranscriptionTime = Date.now();

            if (transcription.item_id && transcription.transcript) {
                this.audioTranscriptions.set(transcription.item_id, {
                    ...transcription,
                    receivedAt: Date.now()
                });

                // Add patient speech to transcript
                this.addToTranscript({
                    role: 'user',
                    content: [{ type: 'text', text: transcription.transcript }],
                    timestamp: new Date().toISOString(),
                    source: 'audio_transcription',
                    itemId: transcription.item_id,
                    confidence: transcription.confidence || null
                });

                console.log(`[TRANSCRIPTION] Patient speech: "${transcription.transcript}" (confidence: ${transcription.confidence})`);
            } else {
                this.logError('processAudioTranscription', new Error('Missing transcript or item_id'), { transcription });
            }
        } catch (error) {
            this.logError('processAudioTranscription', error, { transcription });
        }
    }

    processResponseContent(responseData) {
        try {
            this.performanceMetrics.totalEvents++;
            this.performanceMetrics.responseEvents++;
            this.lastResponseTime = Date.now();

            if (responseData.response_id) {
                this.responseTranscripts.set(responseData.response_id, {
                    ...responseData,
                    receivedAt: Date.now()
                });
            }

            // Extract AI response content
            let aiContent = [];
            if (responseData.content) {
                aiContent = responseData.content;
            } else if (responseData.response && responseData.response.output) {
                responseData.response.output.forEach(item => {
                    if (item.content) {
                        aiContent = aiContent.concat(item.content);
                    }
                });
            }

            if (aiContent.length > 0) {
                this.addToTranscript({
                    role: 'assistant',
                    content: aiContent,
                    timestamp: new Date().toISOString(),
                    source: 'response_content',
                    responseId: responseData.response_id
                });

                console.log(`[TRANSCRIPTION] AI response captured (${aiContent.length} content items)`);
            }
        } catch (error) {
            this.logError('processResponseContent', error, { responseData });
        }
    }

    addToTranscript(entry) {
        this.realtimeTranscript.push(entry);

        // Maintain transcript size (keep last 1000 entries)
        if (this.realtimeTranscript.length > 1000) {
            this.realtimeTranscript = this.realtimeTranscript.slice(-500);
        }
    }

    getFullTranscript() {
        return {
            realtime: this.realtimeTranscript,
            conversationItems: Array.from(this.conversationItems.values()),
            audioTranscriptions: Array.from(this.audioTranscriptions.values()),
            responseTranscripts: Array.from(this.responseTranscripts.values()),
            metadata: {
                callId: this.callId,
                patientId: this.patientId,
                patientMRN: this.patient.mrn,
                startTime: this.startTime,
                duration: Date.now() - this.startTime,
                performanceMetrics: this.performanceMetrics,
                errorLog: this.errorLog
            }
        };
    }

    getSuccessRate() {
        const total = this.performanceMetrics.totalEvents;
        const errors = this.performanceMetrics.errorCount;
        return total > 0 ? ((total - errors) / total * 100).toFixed(2) : 100;
    }
}

// WebSocket for media streams with enhanced transcript capture
fastify.register(async (fastify) => {
    fastify.get('/media-stream/:patientId', { websocket: true }, (connection, req) => {
        const { patientId } = req.params;
        // Fix: Parse callId from query string properly
        const url = new URL(req.url, `http://${req.headers.host}`);
        const callId = url.searchParams.get('callId');
        const patient = patientManager.getPatient(patientId);

        if (!patient) {
            console.error(`Patient ${patientId} not found`);
            connection.close();
            return;
        }

        console.log(`Patient ${patient.name} (MRN: ${patient.mrn}) connected for call ${callId}`);
        logAuditEvent('CALL_CONNECTED', { patientId, mrn: patient.mrn, callId });

        let streamSid = null;

        // Audio buffer to handle race condition between Twilio and OpenAI WebSocket readiness
        let audioBuffer = [];
        let openAiReady = false;
        let sessionInitialized = false;

        // Initialize enhanced transcription manager
        const transcriptionManager = new TranscriptionManager(callId, patientId, patient);

        const openAiWs = new WebSocket(`wss://api.openai.com/v1/realtime?model=gpt-realtime&temperature=${TEMPERATURE}`, {
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
            }
        });

        // Process buffered audio once OpenAI is ready
        const flushAudioBuffer = () => {
            if (!openAiReady || !sessionInitialized) return;

            console.log(`[AUDIO] Flushing ${audioBuffer.length} buffered audio packets`);

            audioBuffer.forEach(audioData => {
                const audioAppend = {
                    type: 'input_audio_buffer.append',
                    audio: audioData
                };
                openAiWs.send(JSON.stringify(audioAppend));
            });

            audioBuffer = []; // Clear buffer after processing
        };

        const initializeSession = () => {
            const systemPrompt = patientManager.generateSystemPrompt(patient);

            const sessionUpdate = {
                type: 'session.update',
                session: {
                    type: 'realtime',
                    model: "gpt-realtime",
                    output_modalities: ["audio"],
                    audio: {
                        input: {
                            format: { type: 'audio/pcmu' },
                            turn_detection: { type: "server_vad" },
                            transcription: { model: "whisper-1" }
                        },
                        output: { format: { type: 'audio/pcmu' }, voice: VOICE },
                    },
                    instructions: systemPrompt,
                },
            };

            openAiWs.send(JSON.stringify(sessionUpdate));
            console.log('[TRANSCRIPTION] Session initialized with input audio transcription enabled');

            // Mark session as initialized
            sessionInitialized = true;

            // Process any buffered audio
            flushAudioBuffer();

            // Initial greeting
            const greeting = {
                type: 'conversation.item.create',
                item: {
                    type: 'message',
                    role: 'user',
                    content: [{
                        type: 'input_text',
                        text: `Please greet ${patient.name} warmly, verify their identity by asking for their date of birth, and then proceed with the wellness check based on the objectives.`
                    }]
                }
            };

            openAiWs.send(JSON.stringify(greeting));
            openAiWs.send(JSON.stringify({ type: 'response.create' }));
        };

        openAiWs.on('open', () => {
            console.log('Connected to OpenAI Realtime API');
            openAiReady = true;

            // Small delay to ensure connection stability before session initialization
            setTimeout(initializeSession, 100);
        });

        openAiWs.on('message', (data) => {
            const startTime = Date.now();

            try {
                const response = JSON.parse(data);

                // Log all events for debugging
                if (response.type !== 'response.output_audio.delta') {
                    console.log(`[REALTIME_EVENT] ${response.type}`);
                }

                // Handle audio output (maintain existing audio pipeline)
                if (response.type === 'response.output_audio.delta' && response.delta) {
                    const audioDelta = {
                        event: 'media',
                        streamSid: streamSid,
                        media: { payload: response.delta }
                    };
                    connection.send(JSON.stringify(audioDelta));
                }

                // CRITICAL: Handle input audio transcription (patient speech)
                if (response.type === 'conversation.item.input_audio_transcription.completed') {
                    transcriptionManager.processAudioTranscription({
                        item_id: response.item_id,
                        transcript: response.transcript,
                        confidence: response.confidence || null
                    });
                }

                // Handle failed transcriptions
                if (response.type === 'conversation.item.input_audio_transcription.failed') {
                    transcriptionManager.logError('audio_transcription_failed',
                        new Error(`Transcription failed for item ${response.item_id}`),
                        { item_id: response.item_id, error: response.error }
                    );
                }

                // Handle conversation items (both user and assistant)
                if (response.type === 'conversation.item.created' && response.item) {
                    transcriptionManager.processConversationItem(response.item);
                }

                // Handle response content (AI responses)
                if (response.type === 'response.content.done' && response.content) {
                    transcriptionManager.processResponseContent({
                        response_id: response.response_id || 'unknown',
                        content: response.content
                    });
                }

                // Handle complete responses
                if (response.type === 'response.done' && response.response) {
                    transcriptionManager.processResponseContent({
                        response_id: response.response.id || 'unknown',
                        response: response.response
                    });
                }

                // Handle session updates (confirms session is ready)
                if (response.type === 'session.updated') {
                    console.log('[AUDIO] Session confirmed ready, flushing any remaining buffered audio');
                    flushAudioBuffer();
                }

                // Handle session errors
                if (response.type === 'error') {
                    transcriptionManager.logError('realtime_api_error',
                        new Error(response.error.message || 'Unknown API error'),
                        response.error
                    );
                }

                // Update performance metrics
                const processingTime = Date.now() - startTime;
                transcriptionManager.performanceMetrics.avgProcessingTime =
                    (transcriptionManager.performanceMetrics.avgProcessingTime + processingTime) / 2;

            } catch (error) {
                transcriptionManager.logError('message_processing', error, { rawData: data.toString() });
            }
        });

        connection.on('message', (message) => {
            try {
                const data = JSON.parse(message);

                switch (data.event) {
                    case 'media':
                        // Buffer audio for fallback transcription
                        transcriptionManager.bufferAudio(data.media.payload);

                        // Check if OpenAI WebSocket is ready and session is initialized
                        if (openAiWs.readyState === WebSocket.OPEN && openAiReady && sessionInitialized) {
                            // Send audio directly when ready
                            const audioAppend = {
                                type: 'input_audio_buffer.append',
                                audio: data.media.payload
                            };
                            openAiWs.send(JSON.stringify(audioAppend));
                        } else {
                            // Buffer audio during connection/initialization phase
                            audioBuffer.push(data.media.payload);

                            // Limit buffer size to prevent memory issues (keep last 5 seconds at 8kHz μ-law = ~40KB)
                            if (audioBuffer.length > 200) {
                                audioBuffer = audioBuffer.slice(-100); // Keep last 50% when buffer is full
                            }

                            // Log only first few instances to avoid spam
                            if (audioBuffer.length <= 5) {
                                console.log(`[AUDIO] Buffering audio packet ${audioBuffer.length} (OpenAI state: ${openAiWs.readyState}, ready: ${openAiReady}, session: ${sessionInitialized})`);
                            }
                        }
                        break;
                    case 'start':
                        streamSid = data.start.streamSid;
                        console.log('Media stream started:', streamSid);
                        logAuditEvent('MEDIA_STREAM_STARTED', {
                            patientId,
                            callId,
                            streamSid
                        });
                        break;
                    case 'stop':
                        console.log('Media stream stopped');
                        logAuditEvent('MEDIA_STREAM_STOPPED', {
                            patientId,
                            callId,
                            streamSid
                        });
                        break;
                }
            } catch (error) {
                transcriptionManager.logError('twilio_message_parsing', error, { message });
            }
        });

        connection.on('close', () => {
            console.log(`[AUDIO] Connection closing. Final buffer size: ${audioBuffer.length} packets`);

            if (openAiWs.readyState === WebSocket.OPEN) openAiWs.close();

            // Clear audio buffer on cleanup
            audioBuffer = [];

            // Get comprehensive transcript data
            const fullTranscript = transcriptionManager.getFullTranscript();
            const successRate = transcriptionManager.getSuccessRate();

            console.log(`[TRANSCRIPTION] Call ended - Success rate: ${successRate}%, Total events: ${fullTranscript.metadata.performanceMetrics.totalEvents}`);

            // Save call session with enhanced transcript
            const sessionData = {
                callId,
                transcript: {
                    // Legacy format for compatibility
                    conversation: fullTranscript.realtime,
                    buffer: fullTranscript.conversationItems,
                    summary: generateCallSummary(fullTranscript.realtime),

                    // Enhanced transcription data
                    enhanced: {
                        fullTranscript: fullTranscript,
                        transcriptionSuccessRate: successRate,
                        totalEvents: fullTranscript.metadata.performanceMetrics.totalEvents,
                        errorCount: fullTranscript.metadata.performanceMetrics.errorCount,
                        audioTranscriptionCount: fullTranscript.metadata.performanceMetrics.transcriptionEvents,
                        responseCount: fullTranscript.metadata.performanceMetrics.responseEvents
                    }
                },
                duration: null, // Will be updated from call status
                endTime: new Date().toISOString(),
                transcriptionMetrics: fullTranscript.metadata.performanceMetrics
            };

            patientManager.recordCallSession(patientId, sessionData);

            logAuditEvent('CALL_ENDED', {
                patientId,
                mrn: patient.mrn,
                callId,
                transcriptLength: fullTranscript.realtime.length,
                successRate: successRate,
                errorCount: fullTranscript.metadata.performanceMetrics.errorCount,
                transcriptionEvents: fullTranscript.metadata.performanceMetrics.transcriptionEvents
            });

            // Log any transcription errors for debugging
            if (fullTranscript.metadata.errorLog.length > 0) {
                console.error(`[TRANSCRIPTION] ${fullTranscript.metadata.errorLog.length} errors during call:`);
                fullTranscript.metadata.errorLog.forEach(error => {
                    console.error(`  - ${error.context}: ${error.error}`);
                });
            }

            console.log(`Patient ${patient.name} disconnected`);
        });

        openAiWs.on('error', (error) => {
            console.error('[OPENAI] WebSocket error:', error.message);
            transcriptionManager.logError('openai_websocket_error', error);

            logAuditEvent('OPENAI_WEBSOCKET_ERROR', {
                patientId,
                callId,
                error: error.message,
                aiDebuggingPrompt: transcriptionManager.generateAIDebuggingPrompt('websocket_error', error, {})
            });
        });

        // Handle OpenAI WebSocket close
        openAiWs.on('close', (code, reason) => {
            console.log(`[OPENAI] WebSocket closed: ${code} ${reason}`);
            openAiReady = false;
            sessionInitialized = false;
        });

        // Add connection error handling
        connection.on('error', (error) => {
            transcriptionManager.logError('twilio_connection_error', error);

            logAuditEvent('TWILIO_CONNECTION_ERROR', {
                patientId,
                callId,
                error: error.message
            });
        });
    });
});

// Helper function to generate call summary
function generateCallSummary(transcript) {
    // Basic summary - detailed analysis happens separately via API
    return {
        totalExchanges: transcript.length,
        topics: extractTopics(transcript),
        generatedAt: new Date().toISOString()
    };
}

// Enhanced post-call analysis (runs independently after call ends)
async function generateDetailedCallAnalysis(transcript, patientData) {
    try {
        // Extract conversation text from transcript
        const conversationText = transcript.map(entry => {
            if (entry.content && entry.content[0] && entry.content[0].transcript) {
                return `${entry.role}: ${entry.content[0].transcript}`;
            }
            return '';
        }).filter(text => text.length > 0).join('\n');

        if (!conversationText.trim()) {
            return {
                error: 'No conversation content found for analysis',
                generatedAt: new Date().toISOString()
            };
        }

        const analysisPrompt = `You are a medical AI assistant analyzing a wellness check phone call transcript.

Patient Information:
- Name: ${patientData.name}
- MRN: ${patientData.mrn}
- Age: ${patientData.age || 'Not specified'}
- Gender: ${patientData.gender || 'Not specified'}
- Primary Concern: ${patientData.primaryConcern || 'General wellness check'}

Call Transcript:
${conversationText}

Please provide a detailed medical analysis in the following JSON format:
{
  "summary": "Brief overview of the call",
  "medicalFindings": {
    "symptoms": ["list of symptoms mentioned"],
    "medications": ["medications discussed"],
    "concerns": ["health concerns raised"],
    "emergencyIndicators": ["any emergency symptoms mentioned"]
  },
  "patientResponse": {
    "engagement": "high/medium/low",
    "cooperation": "cooperative/somewhat cooperative/uncooperative",
    "mentalState": "description of patient's mental state"
  },
  "recommendations": [
    "list of follow-up recommendations"
  ],
  "riskAssessment": {
    "level": "low/medium/high",
    "reasoning": "explanation of risk level"
  },
  "keyQuotes": ["important patient statements"],
  "nextSteps": ["recommended next steps for care team"]
}

Only return valid JSON. Focus on medical accuracy and patient safety.`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: [
                    { role: 'system', content: 'You are a medical AI assistant analyzing patient call transcripts.' },
                    { role: 'user', content: analysisPrompt }
                ],
                temperature: 0.3,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
        }

        const result = await response.json();
        const analysisText = result.choices[0].message.content;

        // Parse the JSON response
        let analysis;
        try {
            analysis = JSON.parse(analysisText);
        } catch (parseError) {
            // If JSON parsing fails, return raw text
            analysis = {
                summary: analysisText,
                error: 'Failed to parse structured analysis',
                rawAnalysis: analysisText
            };
        }

        analysis.generatedAt = new Date().toISOString();
        analysis.model = 'gpt-4';

        return analysis;

    } catch (error) {
        console.error('Error generating detailed call analysis:', error);
        return {
            error: `Analysis failed: ${error.message}`,
            generatedAt: new Date().toISOString()
        };
    }
}

// API endpoint to generate detailed analysis for completed calls
fastify.post('/api/calls/:callId/analyze', async (request, reply) => {
    try {
        const { callId } = request.params;

        // Find the call transcript
        let foundTranscript = null;
        let foundPatient = null;

        for (const [patientId, patient] of patientManager.patients.entries()) {
            for (const callHistory of patient.callHistory || []) {
                if (callHistory.callId === callId || callHistory.timestamp === callId) {
                    foundTranscript = callHistory.transcript;
                    foundPatient = patient;
                    break;
                }
            }
            if (foundTranscript) break;
        }

        if (!foundTranscript || !foundPatient) {
            return reply.status(404).send({ error: 'Call transcript not found' });
        }

        // Generate detailed analysis
        const analysis = await generateDetailedCallAnalysis(
            foundTranscript.conversation || [],
            foundPatient
        );

        // Optionally save the analysis back to the call record
        if (analysis && !analysis.error) {
            for (const [patientId, patient] of patientManager.patients.entries()) {
                for (const callHistory of patient.callHistory || []) {
                    if (callHistory.callId === callId || callHistory.timestamp === callId) {
                        callHistory.detailedAnalysis = analysis;
                        break;
                    }
                }
            }
            await patientManager.saveData();
        }

        reply.send({
            success: true,
            callId,
            patientName: foundPatient.name,
            patientMRN: foundPatient.mrn,
            analysis
        });

    } catch (error) {
        console.error('Error in call analysis endpoint:', error);
        reply.status(500).send({
            error: 'Failed to analyze call',
            message: error.message
        });
    }
});

// API endpoint to get list of calls available for analysis
fastify.get('/api/calls/analyzable', async (request, reply) => {
    try {
        const analyzableCalls = [];

        for (const [patientId, patient] of patientManager.patients.entries()) {
            for (const callHistory of patient.callHistory || []) {
                if (callHistory.transcript && callHistory.transcript.conversation) {
                    analyzableCalls.push({
                        callId: callHistory.callId || callHistory.timestamp,
                        patientName: patient.name,
                        patientMRN: patient.mrn,
                        timestamp: callHistory.timestamp,
                        hasAnalysis: !!callHistory.detailedAnalysis,
                        conversationLength: callHistory.transcript.conversation.length
                    });
                }
            }
        }

        reply.send({
            success: true,
            totalCalls: analyzableCalls.length,
            calls: analyzableCalls.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        });

    } catch (error) {
        console.error('Error getting analyzable calls:', error);
        reply.status(500).send({
            error: 'Failed to get call list',
            message: error.message
        });
    }
});

function extractTopics(transcript) {
    // Simple keyword extraction - enhance as needed
    const keywords = ['medication', 'pain', 'symptom', 'appointment', 'feeling', 'blood pressure', 'glucose'];
    const topics = new Set();

    transcript.forEach(entry => {
        if (entry.content) {
            const content = JSON.stringify(entry.content).toLowerCase();
            keywords.forEach(keyword => {
                if (content.includes(keyword)) {
                    topics.add(keyword);
                }
            });
        }
    });

    return Array.from(topics);
}

// Call status webhook
fastify.post('/call-status', async (request, reply) => {
    const { CallSid, CallStatus, CallDuration, CallDirection, ErrorCode, ErrorMessage } = request.body;
    console.log(`[CALL-STATUS] Call ${CallSid} status: ${CallStatus}${ErrorCode ? ` (Error: ${ErrorCode})` : ''}`);

    const sessionData = patientManager.callSessions.get(CallSid);
    if (sessionData) {
        logAuditEvent('CALL_STATUS_UPDATE', {
            ...sessionData,
            status: CallStatus,
            duration: CallDuration,
            errorCode: ErrorCode,
            errorMessage: ErrorMessage
        });

        // Enhanced failure detection - handle all terminal states
        const isTerminalState = ['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(CallStatus);
        const isFailureState = ['failed', 'busy', 'no-answer', 'canceled'].includes(CallStatus);

        if (isTerminalState) {
            const patient = patientManager.getPatient(sessionData.patientId);

            // Update call record with final status and duration
            if (patient) {
                const callRecord = patient.callHistory.find(c => c.callId === sessionData.callId);
                if (callRecord) {
                    callRecord.duration = CallDuration || 0;
                    callRecord.finalStatus = CallStatus;
                    callRecord.errorCode = ErrorCode;
                    callRecord.errorMessage = ErrorMessage;
                    patientManager.saveData();
                }
            }

            // Check if this is a webhook-triggered call and resolve immediately
            activeWebhookCalls.forEach((webhookCall, webhookCallId) => {
                if (webhookCall.callSid === CallSid) {
                    console.log(`[WEBHOOK] Call ${CallStatus} for webhook ${webhookCallId} (CallSid: ${CallSid})`);

                    if (isFailureState) {
                        // For failed calls, resolve with failure information
                        if (webhookCall.resolve) {
                            webhookCall.resolve({
                                callSid: CallSid,
                                status: CallStatus,
                                success: false,
                                duration: CallDuration || 0,
                                errorCode: ErrorCode,
                                errorMessage: ErrorMessage,
                                transcript: null
                            });
                        }
                        console.log(`[WEBHOOK] ❌ Call failed for webhook ${webhookCallId}: ${CallStatus}${ErrorCode ? ` (${ErrorCode})` : ''}`);
                    } else if (CallStatus === 'completed') {
                        // For completed calls, get transcript
                        const transcript = patientManager.callTranscripts.get(sessionData.callId);

                        // Store the transcript with the webhook call ID
                        if (transcript) {
                            patientManager.callTranscripts.set(webhookCallId, transcript);
                            patientManager.saveTranscripts();
                        }

                        // Resolve the webhook promise
                        if (webhookCall.resolve) {
                            webhookCall.resolve({
                                callSid: CallSid,
                                status: CallStatus,
                                success: true,
                                duration: CallDuration,
                                transcript: transcript || null
                            });
                        }
                        console.log(`[WEBHOOK] ✅ Call completed for webhook ${webhookCallId}`);
                    }

                    // Clean up
                    activeWebhookCalls.delete(webhookCallId);
                }
            });

            // Clean up session data
            patientManager.callSessions.delete(CallSid);
        } else {
            // Log intermediate states for monitoring
            console.log(`[CALL-MONITOR] Call ${CallSid} intermediate status: ${CallStatus}`);
        }
    } else {
        console.log(`[CALL-STATUS] No session data found for CallSid: ${CallSid}`);
    }

    reply.send({ received: true });
});

// Recording status webhook
fastify.post('/recording-status', async (request, reply) => {
    const { RecordingSid, RecordingUrl, CallSid } = request.body;

    const sessionData = patientManager.callSessions.get(CallSid);
    if (sessionData) {
        logAuditEvent('RECORDING_COMPLETED', {
            ...sessionData,
            recordingSid: RecordingSid,
            recordingUrl: RecordingUrl
        });

        // Store recording URL with call record
        const patient = patientManager.getPatient(sessionData.patientId);
        if (patient) {
            const callRecord = patient.callHistory.find(c => c.callId === sessionData.callId);
            if (callRecord) {
                callRecord.recordingUrl = RecordingUrl;
                callRecord.recordingSid = RecordingSid;
                patientManager.saveData();
            }
        }
    }

    reply.send({ received: true });
});

// Import call management system
import { callManagerWebhookHandler } from './call-management/api/webhook-handler.js';

// Webhook endpoint for external agents to trigger calls
fastify.post('/api/webhook/agent-trigger', async (request, reply) => {
    console.log('[WEBHOOK] Received agent trigger request:', JSON.stringify(request.body, null, 2));

    try {
        // Use enhanced agent parser for flexible data extraction
        const parsedData = agentParser.parseAgentData(request.body);

        // Generate parsing report for debugging
        const parsingReport = agentParser.generateParsingReport(request.body, parsedData);
        console.log('[WEBHOOK] Parsing report:', JSON.stringify(parsingReport, null, 2));

        // NEW: Process through call management system for intelligent scheduling
        try {
            const callManagementResult = await callManagerWebhookHandler.handleWebhook(
                request.body,
                parsedData,
                agentParser,
                request
            );

            // If call management handled it (queued/scheduled), return management response
            if (callManagementResult.success && callManagementResult.status !== 'queued') {
                console.log('[WEBHOOK] Call scheduled by management system:', callManagementResult.webhookCallId);
                return reply.send(callManagementResult);
            }

            // If queued for immediate processing, continue with existing flow
            console.log('[WEBHOOK] Call queued for immediate processing, continuing with existing flow');
        } catch (callMgmtError) {
            // If call management fails, continue with existing flow as fallback
            console.warn('[WEBHOOK] Call management error, falling back to direct processing:', callMgmtError.message);
        }

        // Enhanced error handling with parsing report
        if (!parsedData.phoneNumber) {
            return reply.status(400).send({
                error: 'No phone number found',
                message: 'Phone number is required for outbound calls',
                parsingReport: parsingReport,
                supportedFormats: {
                    directFields: agentParser.fieldMappings.phone,
                    ppdDemo: 'Phone: +1234567890 format within PPD_demo text',
                    nestedObjects: 'patient.phone, contact.phone, etc.'
                },
                suggestions: [
                    'Include a "phone" field with the patient\'s number',
                    'Use PPD_demo format with "Phone: +1234567890"',
                    'Try nested formats like {"patient": {"phone": "+1234567890"}}'
                ]
            });
        }

        // Generate a unique MRN if not provided
        if (!parsedData.mrn) {
            parsedData.mrn = `AUTO-${Date.now()}`;
        }

        // Check if patient exists by MRN
        let patient = patientManager.getPatientByMRN(parsedData.mrn);

        if (!patient) {
            // Create new patient using enhanced parser data
            const patientId = crypto.randomUUID();
            patient = {
                id: patientId,
                mrn: parsedData.mrn,
                name: parsedData.name || 'Unknown Patient',
                phoneNumber: parsedData.phoneNumber,
                dateOfBirth: parsedData.dob,
                age: parsedData.age,
                gender: parsedData.gender || 'unknown',
                conditions: parsedData.conditions,
                medications: parsedData.medications,
                primaryConcern: parsedData.notes ? parsedData.notes.substring(0, 200) : '',
                customPrompt: '',
                callObjectives: parsedData.objectives || [],
                consentToRecord: true,
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                callHistory: [],
                webhookSource: {
                    originalPayload: request.body,
                    parsingReport: parsingReport,
                    parsedAt: new Date().toISOString()
                }
            };

            // Set custom prompt based on parsed notes and objectives
            if (parsedData.notes || parsedData.objectives.length > 0) {
                let customPrompt = 'You are conducting a medical wellness check. ';

                if (parsedData.notes) {
                    customPrompt += `\n\nClinical Context:\n${parsedData.notes}\n\n`;
                }

                if (parsedData.objectives.length > 0) {
                    customPrompt += 'During this call, please ensure you:\n';
                    parsedData.objectives.forEach((objective, i) => {
                        customPrompt += `${i + 1}. ${objective}\n`;
                    });
                }

                patient.customPrompt = customPrompt;
            }

            // Add patient to system
            patientManager.addPatient(patient);
            console.log(`[WEBHOOK] Created new patient: ${patient.mrn}`);
        } else {
            // Update existing patient with new information
            if (parsedData.objectives && parsedData.objectives.length > 0) {
                patient.callObjectives = parsedData.objectives;
            }

            if (parsedData.notes) {
                patient.primaryConcern = parsedData.notes.substring(0, 200);

                // Update custom prompt
                let customPrompt = 'You are conducting a medical wellness check. ';
                customPrompt += `\n\nClinical Context:\n${parsedData.notes}\n\n`;

                if (parsedData.objectives && parsedData.objectives.length > 0) {
                    customPrompt += 'During this call, please ensure you:\n';
                    parsedData.objectives.forEach((objective, i) => {
                        customPrompt += `${i + 1}. ${objective}\n`;
                    });
                }

                patient.customPrompt = customPrompt;
            }

            patient.lastModified = new Date().toISOString();
            patientManager.updatePatient(patient.id, patient);
            console.log(`[WEBHOOK] Updated existing patient: ${patient.mrn}`);
        }

        // Generate unique webhook call ID to track this specific call
        const webhookCallId = `webhook-${crypto.randomUUID()}`;

        // Create a promise that will resolve when the call completes
        const callCompletePromise = new Promise((resolve, reject) => {
            activeWebhookCalls.set(webhookCallId, { resolve, reject, startTime: Date.now() });

            // Set timeout of 5 minutes for the call
            setTimeout(() => {
                if (activeWebhookCalls.has(webhookCallId)) {
                    const webhookCall = activeWebhookCalls.get(webhookCallId);
                    const callSid = webhookCall.callSid || 'unknown';
                    const patientId = webhookCall.patientId || 'unknown';

                    console.log(`[WEBHOOK] ⏰ TIMEOUT: Webhook ${webhookCallId} exceeded 5 minutes`);
                    console.log(`[WEBHOOK] ⏰ Call details: CallSid=${callSid}, PatientId=${patientId}`);
                    console.log(`[WEBHOOK] ⏰ This likely indicates a call that connected but never completed or failed to send status webhooks`);

                    activeWebhookCalls.delete(webhookCallId);
                    reject(new Error(`Call timeout - exceeded 5 minutes. CallSid: ${callSid}, PatientId: ${patientId}. Check if call is still active in Twilio console.`));
                }
            }, 5 * 60 * 1000);
        });

        // Initiate the outbound call
        const callResult = await makeOutboundCall(patient);

        // Store the webhook call ID with the Twilio call SID
        if (callResult.callSid) {
            const webhookCall = activeWebhookCalls.get(webhookCallId);
            if (webhookCall) {
                webhookCall.callSid = callResult.callSid;
                webhookCall.patientId = patient.id;
            }
        }

        console.log(`[WEBHOOK] Call initiated: ${callResult.callSid}`);

        // Wait for call to complete and transcript to be available
        console.log('[WEBHOOK] Waiting for call to complete...');

        // For now, return immediate response with call initiation details
        // In a production system, you might want to implement a callback URL
        // or use webhooks to notify when the call completes

        reply.send({
            success: true,
            message: 'Call initiated successfully with enhanced monitoring',
            patientId: patient.id,
            patientMRN: patient.mrn,
            callSid: callResult.callSid,
            webhookCallId: webhookCallId,
            status: 'Call initiated. Enhanced failure detection active.',
            checkStatusUrl: `/api/webhook/status/${webhookCallId}`,
            monitoring: {
                failureDetection: 'Enhanced - will detect failed/busy/no-answer immediately',
                timeoutReduction: 'Immediate resolution on call failure (vs 5min timeout)',
                statusWebhook: 'Active - receiving real-time call status updates',
                supportedFailureStates: ['failed', 'busy', 'no-answer', 'canceled']
            },
            estimatedDuration: '2-5 minutes for successful calls, immediate for failures',
            parsingReport: parsingReport
        });

    } catch (error) {
        console.error('[WEBHOOK] Error processing request:', error);
        reply.status(500).send({
            error: 'Failed to process webhook request',
            message: error.message
        });
    }
});

// Enhanced webhook status check endpoint with call management integration
fastify.get('/api/webhook/status/:webhookCallId', async (request, reply) => {
    const { webhookCallId } = request.params;

    // First check if this is managed by the call management system
    try {
        const managedStatus = await callManagerWebhookHandler.getWebhookStatus(webhookCallId);
        if (managedStatus.success) {
            return reply.send(managedStatus);
        }
    } catch (error) {
        console.warn('[WEBHOOK-STATUS] Call management status check failed, checking legacy system:', error.message);
    }

    // Fallback to legacy system for backward compatibility
    const webhookCall = activeWebhookCalls.get(webhookCallId);

    if (!webhookCall) {
        // Check if we have a completed transcript
        const transcript = patientManager.callTranscripts.get(webhookCallId);

        if (transcript) {
            return reply.send({
                status: 'completed',
                transcript: transcript
            });
        }

        return reply.status(404).send({
            error: 'Webhook call not found or already completed'
        });
    }

    // Call is still in progress
    const duration = Date.now() - webhookCall.startTime;
    reply.send({
        status: 'in_progress',
        callSid: webhookCall.callSid,
        duration: Math.round(duration / 1000) + ' seconds',
        message: 'Call is still in progress'
    });
});

// Enhanced Transcription Debugging and Monitoring API

// Get transcription quality metrics for a specific call
fastify.get('/api/calls/:callId/transcription-metrics', async (request, reply) => {
    try {
        const { callId } = request.params;
        const transcript = patientManager.getCallTranscript(callId);

        if (!transcript) {
            return reply.status(404).send({ error: 'Call transcript not found' });
        }

        const metrics = transcript.enhanced ? transcript.enhanced : {
            transcriptionSuccessRate: 'N/A',
            totalEvents: 0,
            errorCount: 0,
            audioTranscriptionCount: 0,
            responseCount: 0
        };

        reply.send({
            callId,
            metrics,
            recommendations: generateTranscriptionRecommendations(metrics)
        });
    } catch (error) {
        reply.status(500).send({
            error: 'Failed to get transcription metrics',
            message: error.message
        });
    }
});

// AI debugging endpoint for transcription issues
fastify.post('/api/transcription/debug', async (request, reply) => {
    try {
        const { callId, context, issueDescription } = request.body;

        if (!callId) {
            return reply.status(400).send({ error: 'callId is required' });
        }

        const transcript = patientManager.getCallTranscript(callId);
        if (!transcript) {
            return reply.status(404).send({ error: 'Call transcript not found' });
        }

        // Generate comprehensive debugging report
        const debugReport = generateTranscriptionDebugReport(transcript, context, issueDescription);

        reply.send({
            success: true,
            callId,
            debugReport,
            aiDebuggingPrompt: debugReport.aiPrompt,
            recommendations: debugReport.recommendations
        });

    } catch (error) {
        reply.status(500).send({
            error: 'Failed to generate debug report',
            message: error.message
        });
    }
});

// Real-time transcription quality monitoring
fastify.get('/api/transcription/quality-overview', async (request, reply) => {
    try {
        const overview = generateTranscriptionQualityOverview();
        reply.send(overview);
    } catch (error) {
        reply.status(500).send({
            error: 'Failed to generate quality overview',
            message: error.message
        });
    }
});

// Get all transcription errors for debugging
fastify.get('/api/transcription/errors', async (request, reply) => {
    try {
        const { limit = 50, callId } = request.query;
        const errors = getTranscriptionErrors(callId, parseInt(limit));

        reply.send({
            totalErrors: errors.length,
            errors: errors.map(error => ({
                ...error,
                // Include AI debugging prompt for each error
                canAutoDebug: true
            }))
        });
    } catch (error) {
        reply.status(500).send({
            error: 'Failed to get transcription errors',
            message: error.message
        });
    }
});

// Audit log endpoint
fastify.get('/api/audit', async (request, reply) => {
    // In production, add authentication
    reply.send(auditLog.slice(-100)); // Last 100 entries
});

// Helper functions for transcription monitoring
function generateTranscriptionRecommendations(metrics) {
    const recommendations = [];

    if (parseFloat(metrics.transcriptionSuccessRate) < 85) {
        recommendations.push({
            priority: 'high',
            issue: 'Low transcription success rate',
            recommendation: 'Check audio quality settings and input_audio_transcription configuration',
            action: 'Verify μ-law encoding and WAV header handling'
        });
    }

    if (metrics.errorCount > metrics.totalEvents * 0.1) {
        recommendations.push({
            priority: 'medium',
            issue: 'High error rate',
            recommendation: 'Review error logs for common failure patterns',
            action: 'Implement fallback transcription pipeline'
        });
    }

    if (metrics.audioTranscriptionCount === 0) {
        recommendations.push({
            priority: 'critical',
            issue: 'No patient speech transcribed',
            recommendation: 'Verify input_audio_transcription is enabled in session configuration',
            action: 'Check conversation.item.input_audio_transcription.completed event handlers'
        });
    }

    return recommendations;
}

function generateTranscriptionDebugReport(transcript, context, issueDescription) {
    const enhanced = transcript.enhanced || {};
    const fullTranscript = enhanced.fullTranscript || {};
    const metadata = fullTranscript.metadata || {};

    const debugReport = {
        timestamp: new Date().toISOString(),
        context: context || 'Manual debug request',
        issueDescription: issueDescription || 'No specific issue described',

        transcriptionState: {
            successRate: enhanced.transcriptionSuccessRate || 'Unknown',
            totalEvents: enhanced.totalEvents || 0,
            errorCount: enhanced.errorCount || 0,
            audioTranscriptions: enhanced.audioTranscriptionCount || 0,
            responseCount: enhanced.responseCount || 0
        },

        errorAnalysis: metadata.errorLog || [],

        recommendations: [],

        aiPrompt: generateComprehensiveAIPrompt(transcript, context, issueDescription, metadata)
    };

    // Analyze common issues
    if (debugReport.transcriptionState.audioTranscriptions === 0) {
        debugReport.recommendations.push({
            issue: 'No patient speech transcribed',
            cause: 'input_audio_transcription not working',
            fix: 'Verify session.input_audio_transcription.model is set to whisper-1'
        });
    }

    if (debugReport.errorAnalysis.length > 0) {
        const errorTypes = debugReport.errorAnalysis.reduce((acc, error) => {
            acc[error.context] = (acc[error.context] || 0) + 1;
            return acc;
        }, {});

        debugReport.recommendations.push({
            issue: 'Multiple transcription errors detected',
            errorBreakdown: errorTypes,
            fix: 'Review specific error contexts and implement targeted fixes'
        });
    }

    return debugReport;
}

function generateTranscriptionQualityOverview() {
    const allTranscripts = Array.from(patientManager.callTranscripts.values());

    let totalCalls = allTranscripts.length;
    let callsWithEnhanced = 0;
    let totalSuccessRate = 0;
    let totalErrors = 0;
    let totalEvents = 0;

    allTranscripts.forEach(transcript => {
        if (transcript.enhanced) {
            callsWithEnhanced++;
            totalSuccessRate += parseFloat(transcript.enhanced.transcriptionSuccessRate) || 0;
            totalErrors += transcript.enhanced.errorCount || 0;
            totalEvents += transcript.enhanced.totalEvents || 0;
        }
    });

    const avgSuccessRate = callsWithEnhanced > 0 ? (totalSuccessRate / callsWithEnhanced).toFixed(2) : 0;
    const errorRate = totalEvents > 0 ? ((totalErrors / totalEvents) * 100).toFixed(2) : 0;

    return {
        overview: {
            totalCalls,
            callsWithEnhancedTranscription: callsWithEnhanced,
            avgTranscriptionSuccessRate: `${avgSuccessRate}%`,
            overallErrorRate: `${errorRate}%`,
            totalEvents,
            totalErrors
        },
        healthStatus: getTranscriptionHealthStatus(avgSuccessRate, errorRate),
        lastUpdated: new Date().toISOString()
    };
}

function getTranscriptionHealthStatus(successRate, errorRate) {
    if (successRate >= 95 && errorRate <= 2) return 'excellent';
    if (successRate >= 85 && errorRate <= 5) return 'good';
    if (successRate >= 70 && errorRate <= 10) return 'fair';
    return 'needs_attention';
}

function getTranscriptionErrors(callId = null, limit = 50) {
    const errors = [];

    // Collect errors from audit log
    auditLog.forEach(entry => {
        if (entry.event === 'TRANSCRIPTION_ERROR') {
            if (!callId || entry.details.callState.callId === callId) {
                errors.push({
                    timestamp: entry.timestamp,
                    callId: entry.details.callState.callId,
                    patientMRN: entry.details.callState.patientMRN,
                    context: entry.details.context,
                    error: entry.details.error,
                    aiDebuggingPrompt: entry.details.aiDebuggingPrompt
                });
            }
        }
    });

    return errors.slice(-limit);
}

function generateComprehensiveAIPrompt(transcript, context, issueDescription, metadata) {
    return `COMPREHENSIVE TRANSCRIPTION DEBUG REQUEST

ISSUE CONTEXT:
Context: ${context}
Description: ${issueDescription}
Timestamp: ${new Date().toISOString()}

CALL DETAILS:
${metadata.callId ? `Call ID: ${metadata.callId}` : 'Call ID not available'}
${metadata.patientMRN ? `Patient MRN: ${metadata.patientMRN}` : 'Patient MRN not available'}
${metadata.duration ? `Call Duration: ${metadata.duration}ms` : 'Duration unknown'}

TRANSCRIPTION PERFORMANCE:
- Success Rate: ${transcript.enhanced?.transcriptionSuccessRate || 'Unknown'}%
- Total Events: ${transcript.enhanced?.totalEvents || 0}
- Error Count: ${transcript.enhanced?.errorCount || 0}
- Audio Transcriptions: ${transcript.enhanced?.audioTranscriptionCount || 0}
- Response Count: ${transcript.enhanced?.responseCount || 0}

ERROR ANALYSIS:
${metadata.errorLog ? metadata.errorLog.map(error =>
    `- ${error.context}: ${error.error}`
).join('\n') : 'No errors logged'}

SYSTEM CONFIGURATION:
- OpenAI Model: gpt-realtime
- Audio Format: μ-law 8kHz
- Input Transcription: whisper-1
- Voice: ${VOICE}
- Temperature: ${TEMPERATURE}

RECENT TRANSCRIPT SAMPLE:
${transcript.enhanced?.fullTranscript?.realtime ?
    JSON.stringify(transcript.enhanced.fullTranscript.realtime.slice(-3), null, 2) :
    'No transcript data available'}

TROUBLESHOOTING REQUEST:
As an expert in Twilio Media Streams and GPT-4o Realtime API integration, please:

1. Analyze the transcription performance metrics and identify the root cause
2. Provide specific code fixes for any audio pipeline issues
3. Recommend configuration changes to improve transcription reliability
4. Suggest monitoring improvements to prevent future issues
5. If null transcriptions are occurring, provide the exact event handler fix

Focus on production-grade solutions that maintain low-latency audio while ensuring reliable transcription capture.`;
}

// Call management system health check
fastify.get('/api/call-management/health', async (request, reply) => {
    try {
        const health = await callManagerWebhookHandler.healthCheck();
        reply.send(health);
    } catch (error) {
        reply.status(500).send({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Call management queue status
fastify.get('/api/call-management/queue-stats', async (request, reply) => {
    try {
        const stats = await callManagerWebhookHandler.schedulingEngine.getQueueStats();
        reply.send({
            success: true,
            stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        reply.status(500).send({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Test endpoint to verify transcription system configuration
fastify.get('/api/transcription/test-config', async (request, reply) => {
    try {
        const testResults = {
            timestamp: new Date().toISOString(),
            environment: {
                openaiApiKey: !!OPENAI_API_KEY,
                twilioConfigured: !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER),
                nodeVersion: process.version,
                platform: process.platform
            },
            transcriptionConfig: {
                model: 'gpt-realtime',
                voice: VOICE,
                temperature: TEMPERATURE,
                inputTranscriptionModel: 'whisper-1',
                audioFormat: 'audio/pcmu',
                turnDetection: 'server_vad'
            },
            requiredEventHandlers: [
                'conversation.item.input_audio_transcription.completed',
                'conversation.item.input_audio_transcription.failed',
                'conversation.item.created',
                'response.content.done',
                'response.done',
                'error'
            ],
            apiEndpoints: [
                '/api/calls/:callId/transcription-metrics',
                '/api/transcription/debug',
                '/api/transcription/quality-overview',
                '/api/transcription/errors'
            ],
            status: 'Configuration appears valid for production transcription'
        };

        reply.send({
            success: true,
            testResults,
            recommendations: [
                'Test with a real call to verify transcription capture',
                'Monitor /api/transcription/quality-overview for performance metrics',
                'Use /api/transcription/debug for troubleshooting issues',
                'Check /api/transcription/errors for system-wide transcription problems'
            ]
        });

    } catch (error) {
        reply.status(500).send({
            error: 'Failed to test transcription configuration',
            message: error.message
        });
    }
});

// Start server
async function startServer() {
    try {
        console.log('Starting server...');

        // Initialize patient data first
        console.log('Loading patient data...');
        await patientManager.loadData();
        console.log('Patient data loaded successfully');

        console.log('Starting Fastify server...');
        await fastify.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`Medical Outbound Calling System V2 running on port ${PORT}`);
        console.log(`Dashboard: http://localhost:${PORT}/patient-dashboard-v2.html`);
    } catch (err) {
        console.error('Server startup error:', err);
        process.exit(1);
    }
}

startServer();