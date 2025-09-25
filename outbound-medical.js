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
const TEMPERATURE = 0.6; // Lower temperature for medical conversations

// HIPAA Compliance - Audit Trail
const auditLog = [];
const logAuditEvent = (event, patientId, details) => {
    const entry = {
        timestamp: new Date().toISOString(),
        event,
        patientId,
        details,
        sessionId: crypto.randomUUID()
    };
    auditLog.push(entry);
    console.log('[AUDIT]', entry);
};

// Patient Database (In production, use a secure database)
class PatientManager {
    constructor() {
        this.patients = new Map();
        this.callSessions = new Map();
        this.loadPatients();
    }

    async loadPatients() {
        try {
            const data = await fs.readFile('patients.json', 'utf8');
            const patients = JSON.parse(data);
            patients.forEach(patient => {
                this.patients.set(patient.id, patient);
            });
            console.log(`Loaded ${this.patients.size} patients`);
        } catch (error) {
            console.log('No patients file found, starting with empty database');
            this.savePatients();
        }
    }

    async savePatients() {
        const patients = Array.from(this.patients.values());
        await fs.writeFile('patients.json', JSON.stringify(patients, null, 2));
    }

    addPatient(patient) {
        const id = crypto.randomUUID();
        const newPatient = {
            id,
            ...patient,
            createdAt: new Date().toISOString(),
            lastContact: null,
            callHistory: []
        };
        this.patients.set(id, newPatient);
        this.savePatients();
        return newPatient;
    }

    updatePatient(id, updates) {
        const patient = this.patients.get(id);
        if (!patient) return null;

        const updatedPatient = { ...patient, ...updates };
        this.patients.set(id, updatedPatient);
        this.savePatients();
        return updatedPatient;
    }

    getPatient(id) {
        return this.patients.get(id);
    }

    getAllPatients() {
        return Array.from(this.patients.values());
    }

    generateSystemPrompt(patient) {
        const basePrompt = `You are a compassionate and professional medical AI assistant conducting a wellness check call.
        You are speaking with ${patient.name}, a ${patient.age}-year-old ${patient.gender} patient.

        Medical Context:
        - Conditions: ${patient.conditions.join(', ')}
        - Medications: ${patient.medications.join(', ')}
        - Last appointment: ${patient.lastAppointment}
        - Primary concern: ${patient.primaryConcern}

        Call Objectives:
        ${patient.callObjectives.join('\n')}

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

        patient.callHistory.push({
            timestamp: new Date().toISOString(),
            ...sessionData
        });
        patient.lastContact = new Date().toISOString();
        this.savePatients();
    }
}

const patientManager = new PatientManager();

// Call Scheduling System
class CallScheduler {
    constructor() {
        this.scheduledCalls = new Map();
    }

    scheduleCall(patientId, scheduledTime, recurring = false, recurringInterval = null) {
        const callInfo = {
            patientId,
            scheduledTime: new Date(scheduledTime),
            recurring,
            recurringInterval,
            status: 'scheduled'
        };

        const callId = crypto.randomUUID();
        this.scheduledCalls.set(callId, callInfo);

        // Set timeout for the call
        const delay = callInfo.scheduledTime - new Date();
        if (delay > 0) {
            setTimeout(() => this.executeScheduledCall(callId), delay);
        }

        return callId;
    }

    async executeScheduledCall(callId) {
        const callInfo = this.scheduledCalls.get(callId);
        if (!callInfo || callInfo.status !== 'scheduled') return;

        const patient = patientManager.getPatient(callInfo.patientId);
        if (!patient) {
            console.error(`Patient ${callInfo.patientId} not found`);
            return;
        }

        callInfo.status = 'executing';
        await makeOutboundCall(patient);

        // If recurring, schedule next call
        if (callInfo.recurring && callInfo.recurringInterval) {
            const nextTime = new Date(callInfo.scheduledTime);
            nextTime.setDate(nextTime.getDate() + callInfo.recurringInterval);
            this.scheduleCall(callInfo.patientId, nextTime, true, callInfo.recurringInterval);
        }

        this.scheduledCalls.delete(callId);
    }

    getScheduledCalls() {
        return Array.from(this.scheduledCalls.entries()).map(([id, info]) => ({
            id,
            ...info,
            scheduledTime: info.scheduledTime.toISOString()
        }));
    }
}

const callScheduler = new CallScheduler();

// Outbound Call Function
async function makeOutboundCall(patient) {
    if (!patient.phoneNumber) {
        console.error(`No phone number for patient ${patient.id}`);
        return;
    }

    // Validate phone number format
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(patient.phoneNumber)) {
        console.error(`Invalid phone number format: ${patient.phoneNumber}`);
        return;
    }

    logAuditEvent('OUTBOUND_CALL_INITIATED', patient.id, {
        phoneNumber: patient.phoneNumber.slice(-4), // Log only last 4 digits
        purpose: 'Wellness check'
    });

    const baseUrl = process.env.BASE_URL || `https://${process.env.NGROK_URL}`;

    try {
        const call = await client.calls.create({
            from: TWILIO_PHONE_NUMBER,
            to: patient.phoneNumber,
            url: `${baseUrl}/outbound-twiml/${patient.id}`,
            statusCallback: `${baseUrl}/call-status`,
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
            record: false // Set to true if call recording is needed (with proper consent)
        });

        console.log(`Call initiated to patient ${patient.name}: ${call.sid}`);
        patientManager.callSessions.set(call.sid, patient.id);

        return call.sid;
    } catch (error) {
        console.error('Error making outbound call:', error);
        logAuditEvent('OUTBOUND_CALL_FAILED', patient.id, { error: error.message });
        throw error;
    }
}

// Routes
fastify.get('/', async (request, reply) => {
    reply.send({
        message: 'Medical Outbound Calling System Running',
        endpoints: {
            patients: '/api/patients',
            makeCall: '/api/call',
            schedule: '/api/schedule',
            auditLog: '/api/audit'
        }
    });
});

// TwiML for outbound calls
fastify.all('/outbound-twiml/:patientId', async (request, reply) => {
    const { patientId } = request.params;
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
                <Stream url="wss://${request.headers.host}/media-stream/${patientId}" />
            </Connect>
        </Response>`;

    reply.type('text/xml').send(twimlResponse);
});

// Call status webhook
fastify.post('/call-status', async (request, reply) => {
    const { CallSid, CallStatus, To, From } = request.body;
    console.log(`Call ${CallSid} status: ${CallStatus}`);

    const patientId = patientManager.callSessions.get(CallSid);
    if (patientId) {
        logAuditEvent('CALL_STATUS_UPDATE', patientId, {
            status: CallStatus,
            callSid: CallSid
        });

        if (CallStatus === 'completed') {
            patientManager.recordCallSession(patientId, {
                callSid: CallSid,
                status: 'completed',
                duration: request.body.CallDuration
            });
            patientManager.callSessions.delete(CallSid);
        }
    }

    reply.send({ received: true });
});

// WebSocket for media streams with patient context
fastify.register(async (fastify) => {
    fastify.get('/media-stream/:patientId', { websocket: true }, (connection, req) => {
        const { patientId } = req.params;
        const patient = patientManager.getPatient(patientId);

        if (!patient) {
            console.error(`Patient ${patientId} not found`);
            connection.close();
            return;
        }

        console.log(`Patient ${patient.name} connected for call`);
        logAuditEvent('CALL_CONNECTED', patientId, { timestamp: new Date().toISOString() });

        let streamSid = null;
        let latestMediaTimestamp = 0;
        let callTranscript = [];

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

            console.log('Initializing session for patient:', patient.name);
            openAiWs.send(JSON.stringify(sessionUpdate));

            // Send initial greeting
            const greeting = {
                type: 'conversation.item.create',
                item: {
                    type: 'message',
                    role: 'user',
                    content: [{
                        type: 'input_text',
                        text: `Please greet ${patient.name} warmly, verify their identity by asking for their date of birth, and then proceed with the wellness check.`
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

                // Log conversation for medical records
                if (response.type === 'conversation.item.created' && response.item.content) {
                    callTranscript.push({
                        role: response.item.role,
                        content: response.item.content,
                        timestamp: new Date().toISOString()
                    });
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
                        latestMediaTimestamp = data.media.timestamp;
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

            // Save call transcript
            patientManager.recordCallSession(patientId, {
                transcript: callTranscript,
                endTime: new Date().toISOString()
            });

            logAuditEvent('CALL_ENDED', patientId, {
                transcriptLength: callTranscript.length
            });

            console.log(`Patient ${patient.name} disconnected`);
        });

        openAiWs.on('error', (error) => {
            console.error('OpenAI WebSocket error:', error);
        });
    });
});

// API Routes for Patient Management
fastify.get('/api/patients', async (request, reply) => {
    const patients = patientManager.getAllPatients();
    reply.send(patients.map(p => ({
        ...p,
        phoneNumber: p.phoneNumber ? `***-***-${p.phoneNumber.slice(-4)}` : null
    })));
});

fastify.post('/api/patients', async (request, reply) => {
    const patient = patientManager.addPatient(request.body);
    logAuditEvent('PATIENT_CREATED', patient.id, { name: patient.name });
    reply.send(patient);
});

fastify.put('/api/patients/:id', async (request, reply) => {
    const patient = patientManager.updatePatient(request.params.id, request.body);
    if (!patient) {
        reply.status(404).send({ error: 'Patient not found' });
        return;
    }
    logAuditEvent('PATIENT_UPDATED', patient.id, { updates: Object.keys(request.body) });
    reply.send(patient);
});

// API Route to initiate call
fastify.post('/api/call', async (request, reply) => {
    const { patientId } = request.body;
    const patient = patientManager.getPatient(patientId);

    if (!patient) {
        reply.status(404).send({ error: 'Patient not found' });
        return;
    }

    try {
        const callSid = await makeOutboundCall(patient);
        reply.send({ success: true, callSid });
    } catch (error) {
        reply.status(500).send({ error: error.message });
    }
});

// API Route to schedule calls
fastify.post('/api/schedule', async (request, reply) => {
    const { patientId, scheduledTime, recurring, recurringInterval } = request.body;
    const callId = callScheduler.scheduleCall(patientId, scheduledTime, recurring, recurringInterval);
    reply.send({ callId, scheduled: true });
});

fastify.get('/api/schedule', async (request, reply) => {
    const scheduled = callScheduler.getScheduledCalls();
    reply.send(scheduled);
});

// API Route for audit log (restricted access in production)
fastify.get('/api/audit', async (request, reply) => {
    // In production, add authentication and authorization
    reply.send(auditLog);
});

// Start server
fastify.listen({ port: PORT }, (err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`Medical Outbound Calling System running on port ${PORT}`);
    console.log(`Configure ngrok and set BASE_URL environment variable`);
});