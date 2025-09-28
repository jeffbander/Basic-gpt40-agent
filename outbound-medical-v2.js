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
import fetch from 'node-fetch';

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
        this.loadData();
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
            // Use embedded transcript if available, otherwise check separate transcripts file
            transcript: call.transcript || this.callTranscripts.get(call.callId)
        }));
    }

    getCallTranscript(callId) {
        // First check the separate transcripts Map
        let transcript = this.callTranscripts.get(callId);
        if (transcript) return transcript;

        // If not found, search for embedded transcript in patient call history
        for (const patient of this.patients.values()) {
            const call = patient.callHistory.find(c => c.callId === callId);
            if (call && call.transcript) {
                return call.transcript;
            }
        }

        return null;
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

    // Parse Patient Name
    const nameMatch = ppdDemoText.match(/Patient Name:\s*([^\n]+)/i);
    if (nameMatch) {
        parsed.name = nameMatch[1].trim();
    }

    // Parse MRN
    const mrnMatch = ppdDemoText.match(/MRN:\s*([^\n]+)/i);
    if (mrnMatch) {
        parsed.mrn = mrnMatch[1].trim();
    }

    // Parse Date of Birth
    const dobMatch = ppdDemoText.match(/(?:Date of Birth|DOB):\s*([^\n]+)/i);
    if (dobMatch) {
        const dobStr = dobMatch[1].trim();
        // Try to parse date in various formats
        const dateFormats = [
            /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // MM/DD/YYYY
            /(\d{4})-(\d{2})-(\d{2})/,       // YYYY-MM-DD
        ];

        for (const format of dateFormats) {
            const match = dobStr.match(format);
            if (match) {
                if (format === dateFormats[0]) {
                    parsed.dateOfBirth = `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
                } else {
                    parsed.dateOfBirth = match[0];
                }
                break;
            }
        }
    }

    // Parse Phone Number
    const phoneMatch = ppdDemoText.match(/(?:Phone|Phone Number|Contact):\s*([^\n]+)/i);
    if (phoneMatch) {
        // Clean phone number - remove non-digits except + at start
        const phone = phoneMatch[1].trim();
        parsed.phoneNumber = phone.replace(/\D/g, '');
    }

    // Parse Gender
    const genderMatch = ppdDemoText.match(/(?:Gender|Sex):\s*([^\n]+)/i);
    if (genderMatch) {
        const gender = genderMatch[1].trim().toLowerCase();
        parsed.gender = gender.startsWith('m') ? 'male' : gender.startsWith('f') ? 'female' : 'other';
    }

    // Parse Conditions/Diagnoses
    const conditionsMatch = ppdDemoText.match(/(?:Conditions?|Diagnos[ie]s|Medical History):\s*([^\n]+)/i);
    if (conditionsMatch) {
        parsed.conditions = conditionsMatch[1]
            .split(/[,;]/)
            .map(c => c.trim())
            .filter(c => c.length > 0);
    }

    // Parse Medications
    const medsMatch = ppdDemoText.match(/(?:Medications?|Current Medications?):\s*([^\n]+)/i);
    if (medsMatch) {
        parsed.medications = medsMatch[1]
            .split(/[,;]/)
            .map(m => m.trim())
            .filter(m => m.length > 0);
    }

    // Calculate age if DOB is provided
    if (parsed.dateOfBirth) {
        const dob = new Date(parsed.dateOfBirth);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
            age--;
        }
        parsed.age = age;
    }

    return parsed;
}

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
            callOptions.recordingChannels = 'dual'; // Records both sides separately
            callOptions.recordingStatusCallback = `${baseUrl}/recording-status`;
            callOptions.recordingStatusCallbackEvent = ['completed'];
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
        let callTranscript = [];
        let conversationBuffer = [];

        const openAiWs = new WebSocket(`wss://api.openai.com/v1/realtime?model=gpt-realtime&temperature=${TEMPERATURE}`, {
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
            }
        });

        const initializeSession = () => {
            const systemPrompt = patientManager.generateSystemPrompt(patient);

            const sessionUpdate = {
                type: 'session.update',
                session: {
                    type: 'realtime',
                    model: "gpt-realtime",
                    output_modalities: ["audio"],
                    audio: {
                        input: { format: { type: 'audio/pcmu' }, turn_detection: { type: "server_vad" } },
                        output: { format: { type: 'audio/pcmu' }, voice: VOICE },
                    },
                    instructions: systemPrompt,
                },
            };

            openAiWs.send(JSON.stringify(sessionUpdate));

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
            setTimeout(initializeSession, 100);
        });

        openAiWs.on('message', (data) => {
            try {
                const response = JSON.parse(data);

                if (response.type === 'response.output_audio.delta' && response.delta) {
                    const audioDelta = {
                        event: 'media',
                        streamSid: streamSid,
                        media: { payload: response.delta }
                    };
                    connection.send(JSON.stringify(audioDelta));
                }

                // Capture conversation for transcript
                if (response.type === 'conversation.item.created' && response.item) {
                    conversationBuffer.push({
                        role: response.item.role,
                        content: response.item.content,
                        timestamp: new Date().toISOString()
                    });
                    console.log('Conversation item captured:', response.item.role);
                }

                // Capture text responses for transcript
                if (response.type === 'response.content.done' && response.content) {
                    callTranscript.push({
                        role: 'assistant',
                        content: response.content,
                        timestamp: new Date().toISOString()
                    });
                    console.log('Assistant response captured');
                }

                // Also capture response.done events which contain the full message
                if (response.type === 'response.done' && response.response) {
                    const output = response.response.output;
                    if (output && output.length > 0) {
                        output.forEach(item => {
                            if (item.type === 'message' && item.content) {
                                callTranscript.push({
                                    role: item.role || 'assistant',
                                    content: item.content,
                                    timestamp: new Date().toISOString()
                                });
                                console.log('Response content captured from response.done');
                            }
                        });
                    }
                }

            } catch (error) {
                console.error('Error processing OpenAI message:', error);
            }
        });

        connection.on('message', (message) => {
            try {
                const data = JSON.parse(message);

                switch (data.event) {
                    case 'media':
                        if (openAiWs.readyState === WebSocket.OPEN) {
                            const audioAppend = {
                                type: 'input_audio_buffer.append',
                                audio: data.media.payload
                            };
                            openAiWs.send(JSON.stringify(audioAppend));
                        }
                        break;
                    case 'start':
                        streamSid = data.start.streamSid;
                        console.log('Media stream started:', streamSid);
                        break;
                }
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        });

        connection.on('close', () => {
            if (openAiWs.readyState === WebSocket.OPEN) openAiWs.close();

            // Save call session with transcript
            const sessionData = {
                callId,
                transcript: {
                    conversation: callTranscript,
                    buffer: conversationBuffer,
                    summary: generateCallSummary(callTranscript)
                },
                duration: null, // Will be updated from call status
                endTime: new Date().toISOString()
            };

            patientManager.recordCallSession(patientId, sessionData);

            logAuditEvent('CALL_ENDED', {
                patientId,
                mrn: patient.mrn,
                callId,
                transcriptLength: callTranscript.length
            });

            console.log(`Patient ${patient.name} disconnected`);
        });

        openAiWs.on('error', (error) => {
            console.error('OpenAI WebSocket error:', error);
        });
    });
});

// Helper function to generate call summary
function generateCallSummary(transcript) {
    // Basic summary - in production, you might use AI to generate this
    return {
        totalExchanges: transcript.length,
        topics: extractTopics(transcript),
        generatedAt: new Date().toISOString()
    };
}

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
    const { CallSid, CallStatus, CallDuration } = request.body;
    console.log(`Call ${CallSid} status: ${CallStatus}`);

    const sessionData = patientManager.callSessions.get(CallSid);
    if (sessionData) {
        logAuditEvent('CALL_STATUS_UPDATE', {
            ...sessionData,
            status: CallStatus,
            duration: CallDuration
        });

        if (CallStatus === 'completed' && CallDuration) {
            // Update call record with duration
            const patient = patientManager.getPatient(sessionData.patientId);
            if (patient) {
                const callRecord = patient.callHistory.find(c => c.callId === sessionData.callId);
                if (callRecord) {
                    callRecord.duration = CallDuration;
                    patientManager.saveData();
                }
            }

            // Check if this is a webhook-triggered call
            activeWebhookCalls.forEach(async (webhookCall, webhookCallId) => {
                if (webhookCall.callSid === CallSid) {
                    // Get the transcript for this call
                    const transcript = patientManager.callTranscripts.get(sessionData.callId);

                    // Store the transcript with the webhook call ID
                    if (transcript) {
                        patientManager.callTranscripts.set(webhookCallId, transcript);
                        patientManager.saveTranscripts();
                    }

                    // Send completion webhook if callback URL was provided
                    if (webhookCall.callbackUrl) {
                        try {
                            const callbackData = {
                                webhookCallId: webhookCallId,
                                status: 'completed',
                                patientMRN: webhookCall.patientMRN,
                                callSid: CallSid,
                                duration: CallDuration,
                                transcript: transcript || null,
                                completedAt: new Date().toISOString()
                            };

                            console.log(`[WEBHOOK] Sending completion callback to ${webhookCall.callbackUrl}`);

                            await fetch(webhookCall.callbackUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(callbackData)
                            });

                            console.log(`[WEBHOOK] Completion callback sent successfully for ${webhookCallId}`);
                        } catch (error) {
                            console.error('[WEBHOOK] Error sending completion callback:', error);
                        }
                    }

                    // Clean up the webhook call tracking
                    activeWebhookCalls.delete(webhookCallId);
                    console.log(`[WEBHOOK] Call completed for webhook ${webhookCallId}`);
                }
            });

            patientManager.callSessions.delete(CallSid);
        }
    }

    reply.send({ received: true });
});

// Function to transcribe recording using OpenAI Whisper
async function transcribeRecording(recordingUrl) {
    try {
        console.log('[TRANSCRIPTION] Starting transcription for recording:', recordingUrl);

        // Download the recording from Twilio
        const recordingResponse = await fetch(recordingUrl + '.mp3', {
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')
            }
        });

        if (!recordingResponse.ok) {
            throw new Error(`Failed to download recording: ${recordingResponse.statusText}`);
        }

        const audioBuffer = await recordingResponse.buffer();

        // Create form data for Whisper API
        const FormData = (await import('form-data')).default;
        const formData = new FormData();
        formData.append('file', audioBuffer, {
            filename: 'recording.mp3',
            contentType: 'audio/mpeg'
        });
        formData.append('model', 'whisper-1');
        formData.append('response_format', 'verbose_json');
        formData.append('timestamp_granularities', '["word"]');

        // Send to OpenAI Whisper API
        const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                ...formData.getHeaders()
            },
            body: formData
        });

        if (!whisperResponse.ok) {
            const error = await whisperResponse.text();
            throw new Error(`Whisper API error: ${error}`);
        }

        const transcription = await whisperResponse.json();
        console.log('[TRANSCRIPTION] Completed successfully');

        return transcription;
    } catch (error) {
        console.error('[TRANSCRIPTION] Error:', error);
        throw error;
    }
}

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

                // Transcribe the recording asynchronously
                transcribeRecording(RecordingUrl)
                    .then(transcription => {
                        // Update the call transcript with the full conversation
                        if (callRecord.transcript) {
                            callRecord.transcript.fullTranscription = transcription;
                            callRecord.transcript.text = transcription.text;

                            // Also update the saved transcript
                            const savedTranscript = patientManager.callTranscripts.get(sessionData.callId);
                            if (savedTranscript) {
                                savedTranscript.fullTranscription = transcription;
                                savedTranscript.completeText = transcription.text;
                                patientManager.saveTranscripts();
                            }

                            patientManager.saveData();
                            console.log(`[TRANSCRIPTION] Saved full transcript for call ${sessionData.callId}`);
                        }
                    })
                    .catch(error => {
                        console.error('[TRANSCRIPTION] Failed to transcribe recording:', error);
                    });

                patientManager.saveData();
            }
        }
    }

    reply.send({ received: true });
});

// Webhook endpoint for external agents to trigger calls
fastify.post('/api/webhook/agent-trigger', async (request, reply) => {
    // Handle both PPD_demo and PPD_Demo (case variations)
    const { call_objectives, Master_note, Master_Note } = request.body;
    const PPD_demo = request.body.PPD_demo || request.body.PPD_Demo;
    const masterNote = Master_note || Master_Note;

    console.log('[WEBHOOK] Received agent trigger request');
    console.log('[WEBHOOK] Request body:', JSON.stringify(request.body, null, 2));

    // Check if PPD_demo exists
    if (!PPD_demo) {
        console.log('[WEBHOOK ERROR] No PPD_demo provided in request');
        return reply.status(400).send({
            error: 'PPD_demo is required',
            message: 'Please provide patient demographics in PPD_demo or PPD_Demo field',
            received: request.body
        });
    }

    try {
        // Parse patient demographics from PPD_demo
        const parsedData = parsePPDDemo(PPD_demo);
        console.log('[WEBHOOK] Parsed data:', JSON.stringify(parsedData, null, 2));

        if (!parsedData.phoneNumber) {
            console.log('[WEBHOOK ERROR] No phone number parsed from PPD_demo');
            return reply.status(400).send({
                error: 'No phone number found in PPD_demo',
                message: 'Please include a phone number in the patient demographics',
                parsed: parsedData,
                ppd_demo_received: PPD_demo
            });
        }

        // Generate a unique MRN if not provided
        if (!parsedData.mrn) {
            parsedData.mrn = `AUTO-${Date.now()}`;
        }

        // Check if patient exists by MRN
        let patient = patientManager.getPatientByMRN(parsedData.mrn);

        if (!patient) {
            // Create new patient (don't include id - let addPatient generate it)
            const patientData = {
                mrn: parsedData.mrn,
                name: parsedData.name || 'Unknown Patient',
                phoneNumber: parsedData.phoneNumber,
                dateOfBirth: parsedData.dateOfBirth,
                age: parsedData.age,
                gender: parsedData.gender || 'unknown',
                conditions: parsedData.conditions || [],
                medications: parsedData.medications || [],
                primaryConcern: masterNote ? masterNote.substring(0, 200) : '',
                clinicalNotes: masterNote || '',  // Store full Master_Note here
                customPrompt: '',
                callObjectives: call_objectives || [],  // Store raw call_objectives
                consentToRecord: true,
                callHistory: []
            };

            // Set custom prompt based on masterNote and call_objectives
            if (masterNote || call_objectives) {
                let customPrompt = 'You are conducting a medical wellness check. ';

                // Add clinical context from Master_Note
                if (masterNote) {
                    customPrompt += `\n\nClinical Context:\n${masterNote}\n\n`;
                }

                // Handle call_objectives - these are the questions/tasks for the call
                if (call_objectives) {
                    if (typeof call_objectives === 'string') {
                        // If it's a string, parse it as questions/objectives
                        customPrompt += '\nQuestions to ask during this call:\n' + call_objectives + '\n';
                        customPrompt += '\nMake sure to ask each question and document the responses.\n';
                    } else if (Array.isArray(call_objectives) && call_objectives.length > 0) {
                        // If it's an array, iterate through the questions
                        customPrompt += '\nQuestions to ask during this call:\n';
                        call_objectives.forEach((objective, i) => {
                            customPrompt += `${i + 1}. ${objective}\n`;
                        });
                        customPrompt += '\nMake sure to ask each question and document the responses.\n';
                    }
                }

                patientData.customPrompt = customPrompt;
            }

            // Add patient to system
            patient = patientManager.addPatient(patientData);
            console.log(`[WEBHOOK] Created new patient: ${patient.mrn}`);
        } else {
            // Update existing patient with new information
            if (call_objectives) {
                // Store call_objectives as-is (string or array)
                patient.callObjectives = call_objectives;
            }

            if (masterNote) {
                patient.primaryConcern = masterNote.substring(0, 200);
                patient.clinicalNotes = masterNote; // Also update clinicalNotes for existing patients

                // Update custom prompt
                let customPrompt = 'You are conducting a medical wellness check. ';
                customPrompt += `\n\nClinical Context:\n${masterNote}\n\n`;

                // Handle call_objectives - these are the questions/tasks for the call
                if (call_objectives) {
                    if (typeof call_objectives === 'string') {
                        // If it's a string, parse it as questions/objectives
                        customPrompt += '\nQuestions to ask during this call:\n' + call_objectives + '\n';
                        customPrompt += '\nMake sure to ask each question and document the responses.\n';
                    } else if (Array.isArray(call_objectives) && call_objectives.length > 0) {
                        // If it's an array, iterate through the questions
                        customPrompt += '\nQuestions to ask during this call:\n';
                        call_objectives.forEach((objective, i) => {
                            customPrompt += `${i + 1}. ${objective}\n`;
                        });
                        customPrompt += '\nMake sure to ask each question and document the responses.\n';
                    }
                }

                patient.customPrompt = customPrompt;
            }

            patient.lastModified = new Date().toISOString();
            patientManager.updatePatient(patient.id, patient);
            console.log(`[WEBHOOK] Updated existing patient: ${patient.mrn}`);
        }

        // Generate unique webhook call ID to track this specific call
        const webhookCallId = `webhook-${crypto.randomUUID()}`;

        // Send immediate acknowledgement to prevent retries
        reply.send({
            success: true,
            message: 'Webhook received and processing',
            patientId: patient.id,
            patientMRN: patient.mrn,
            webhookCallId: webhookCallId,
            status: 'Processing call request'
        });

        // Process the call asynchronously after sending acknowledgement
        setImmediate(async () => {
            try {
                // Initiate the outbound call
                const callResult = await makeOutboundCall(patient);

                console.log(`[WEBHOOK] Call initiated: ${callResult.callSid}`);

                // Store the webhook call info
                activeWebhookCalls.set(webhookCallId, {
                    callSid: callResult.callSid,
                    patientId: patient.id,
                    patientMRN: patient.mrn,
                    startTime: Date.now(),
                    callbackUrl: request.body.callback_url || null
                });

                // If a callback URL was provided, we'll send completion notification there
                // This will be handled in the call-status endpoint when call completes

            } catch (error) {
                console.error(`[WEBHOOK] Error initiating call for ${patient.mrn}:`, error);

                // If there's a callback URL, notify of the error
                if (request.body.callback_url) {
                    try {
                        await fetch(request.body.callback_url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                webhookCallId: webhookCallId,
                                status: 'failed',
                                error: error.message,
                                patientMRN: patient.mrn
                            })
                        });
                    } catch (callbackError) {
                        console.error('[WEBHOOK] Error sending callback:', callbackError);
                    }
                }
            }
        });

    } catch (error) {
        console.error('[WEBHOOK] Error processing request:', error);
        reply.status(500).send({
            error: 'Failed to process webhook request',
            message: error.message
        });
    }
});

// Webhook status check endpoint
fastify.get('/api/webhook/status/:webhookCallId', async (request, reply) => {
    const { webhookCallId } = request.params;

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

// Audit log endpoint
fastify.get('/api/audit', async (request, reply) => {
    // In production, add authentication
    reply.send(auditLog.slice(-100)); // Last 100 entries
});

// Start server
fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`Medical Outbound Calling System V2 running on port ${PORT}`);
    console.log(`Dashboard: http://localhost:${PORT}/patient-dashboard-v2.html`);
});