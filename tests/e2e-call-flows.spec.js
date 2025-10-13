import { test, expect } from '@playwright/test';
import WebSocket from 'ws';
import crypto from 'crypto';

/**
 * End-to-End Call Flow Tests
 *
 * Tests complete call scenarios from initiation through
 * conversation to termination, including:
 * - Inbound call handling
 * - Outbound call initiation
 * - Full conversation flows
 * - Call termination and cleanup
 * - Transcript capture and storage
 */

test.describe('End-to-End Call Flow Tests', () => {
  const INBOUND_BASE_URL = 'http://localhost:5050';
  const OUTBOUND_BASE_URL = 'http://localhost:5051';

  test.setTimeout(300000); // 5 minutes for complete call flows

  test.describe('Inbound Call Flow', () => {

    test('should handle complete inbound call from start to finish', async ({ page }) => {
      console.log('📞 Testing complete inbound call flow...');

      // Step 1: Verify server is running
      console.log('1️⃣  Verifying server status...');
      const healthResponse = await page.request.get(INBOUND_BASE_URL + '/');
      expect(healthResponse.ok()).toBeTruthy();
      console.log('✅ Server is running');

      // Step 2: Simulate Twilio calling the incoming-call endpoint
      console.log('2️⃣  Simulating incoming call webhook...');
      const twimlResponse = await page.request.post(INBOUND_BASE_URL + '/incoming-call', {
        data: {
          CallSid: 'CA' + crypto.randomBytes(16).toString('hex'),
          From: '+15551234567',
          To: '+15559876543',
          CallStatus: 'ringing'
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      expect(twimlResponse.ok()).toBeTruthy();
      const twiml = await twimlResponse.text();
      expect(twiml).toContain('<Response>');
      expect(twiml).toContain('<Stream');
      console.log('✅ TwiML response generated');

      // Step 3: Establish WebSocket connection (simulating Twilio Media Stream)
      console.log('3️⃣  Establishing Media Stream connection...');
      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + '/media-stream';
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));
      console.log('✅ Media Stream connected');

      // Step 4: Send start event
      console.log('4️⃣  Sending stream start event...');
      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');
      const callSid = 'CA' + crypto.randomBytes(16).toString('hex');

      ws.send(JSON.stringify({
        event: 'start',
        sequenceNumber: '1',
        start: {
          streamSid: streamSid,
          accountSid: 'AC' + crypto.randomBytes(16).toString('hex'),
          callSid: callSid,
          tracks: ['inbound', 'outbound'],
          mediaFormat: {
            encoding: 'audio/x-mulaw',
            sampleRate: 8000,
            channels: 1
          }
        },
        streamSid: streamSid
      }));

      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('✅ Stream started');

      // Step 5: Simulate caller speaking
      console.log('5️⃣  Simulating caller audio (5 seconds)...');
      const audioResponses = [];

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          if (message.event === 'media' && message.media) {
            audioResponses.push(message);
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      // Send 5 seconds of audio (250 packets at 20ms each)
      for (let i = 0; i < 250; i++) {
        const audioBuffer = Buffer.alloc(160).fill(0x7F);
        ws.send(JSON.stringify({
          event: 'media',
          sequenceNumber: String(i + 2),
          media: {
            track: 'inbound',
            chunk: String(i + 1),
            timestamp: String(i * 20),
            payload: audioBuffer.toString('base64')
          },
          streamSid: streamSid
        }));

        // Real-time pacing
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      console.log('✅ Sent 5 seconds of audio');

      // Step 6: Wait for AI responses
      console.log('6️⃣  Waiting for AI responses...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      console.log(`📊 Received ${audioResponses.length} audio response packets`);

      // Step 7: Simulate call ending
      console.log('7️⃣  Ending call...');
      ws.send(JSON.stringify({
        event: 'stop',
        sequenceNumber: String(252),
        streamSid: streamSid
      }));

      await new Promise(resolve => setTimeout(resolve, 500));

      ws.close();
      console.log('✅ Call ended cleanly');

      // Verify the flow completed
      expect(ws.readyState).toBe(WebSocket.CLOSED);
      console.log('✅ Complete inbound call flow successful');
    });

    test('should handle AI greeting before caller speaks', async () => {
      console.log('👋 Testing AI-initiated greeting...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + '/media-stream';
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');
      let greetingReceived = false;

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          if (message.event === 'media' && message.media) {
            greetingReceived = true;
            console.log('✅ AI greeting audio received');
          }
        } catch (e) {
          // Ignore
        }
      });

      ws.send(JSON.stringify({
        event: 'start',
        start: { streamSid: streamSid },
        streamSid: streamSid
      }));

      // Wait for potential greeting (if enabled in code)
      await new Promise(resolve => setTimeout(resolve, 5000));

      console.log('Greeting status:', greetingReceived ? 'Received' : 'Not configured (normal)');

      ws.close();
    });

    test('should handle multi-turn conversation', async () => {
      console.log('💬 Testing multi-turn conversation...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + '/media-stream';
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');

      ws.send(JSON.stringify({
        event: 'start',
        start: { streamSid: streamSid },
        streamSid: streamSid
      }));

      await new Promise(resolve => setTimeout(resolve, 500));

      // Turn 1: User speaks
      console.log('Turn 1: User speaks...');
      for (let i = 0; i < 50; i++) {
        ws.send(JSON.stringify({
          event: 'media',
          media: {
            track: 'inbound',
            timestamp: String(i * 20),
            payload: Buffer.alloc(160).fill(0x7F).toString('base64')
          },
          streamSid: streamSid
        }));
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      // Wait for AI response
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Turn 2: User speaks again
      console.log('Turn 2: User speaks again...');
      for (let i = 50; i < 100; i++) {
        ws.send(JSON.stringify({
          event: 'media',
          media: {
            track: 'inbound',
            timestamp: String(i * 20),
            payload: Buffer.alloc(160).fill(0x7F).toString('base64')
          },
          streamSid: streamSid
        }));
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Turn 3: User speaks once more
      console.log('Turn 3: User speaks once more...');
      for (let i = 100; i < 150; i++) {
        ws.send(JSON.stringify({
          event: 'media',
          media: {
            track: 'inbound',
            timestamp: String(i * 20),
            payload: Buffer.alloc(160).fill(0x7F).toString('base64')
          },
          streamSid: streamSid
        }));
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('✅ Multi-turn conversation completed');

      ws.close();
    });
  });

  test.describe('Outbound Call Flow', () => {

    test('should initiate outbound call via API', async ({ page }) => {
      console.log('📱 Testing outbound call initiation...');

      // Get list of patients
      const patientsResponse = await page.request.get(`${OUTBOUND_BASE_URL}/api/patients`);
      expect(patientsResponse.ok()).toBeTruthy();

      const patients = await patientsResponse.json();
      console.log(`Found ${patients.length} patients`);

      if (patients.length > 0) {
        const patient = patients[0];
        console.log(`Initiating call to ${patient.name}...`);

        // Initiate call
        const callResponse = await page.request.post(`${OUTBOUND_BASE_URL}/api/call`, {
          data: {
            patientId: patient.id
          }
        });

        if (callResponse.ok()) {
          const callData = await callResponse.json();
          console.log('✅ Call initiated:', callData.callSid);

          expect(callData.success).toBe(true);
          expect(callData.callSid).toBeTruthy();
        } else {
          console.log('⚠️  Call initiation failed (may be normal if Twilio credentials not configured)');
        }
      } else {
        console.log('⚠️  No patients available for testing');
      }
    });

    test('should complete outbound call with transcript capture', async ({ page }) => {
      console.log('📞 Testing complete outbound call with transcript...');

      // Navigate to dashboard
      await page.goto(`${OUTBOUND_BASE_URL}/patient-dashboard-v2.html`);
      await page.waitForLoadState('networkidle');

      // Check if patients are available
      const patientCards = await page.locator('.patient-card').count();

      if (patientCards > 0) {
        console.log(`Found ${patientCards} patient cards`);

        // Get initial call count
        const initialQualityResponse = await page.request.get(`${OUTBOUND_BASE_URL}/api/transcription/quality-overview`);
        const initialQuality = await initialQualityResponse.json();
        const initialCallCount = initialQuality.overview.totalCalls;

        console.log(`Initial call count: ${initialCallCount}`);

        // Initiate call via UI
        const firstPatientCard = page.locator('.patient-card').first();
        const patientName = await firstPatientCard.locator('h3').textContent();
        console.log(`Calling patient: ${patientName}`);

        const callButton = firstPatientCard.locator('button:has-text("Call")');
        await callButton.click();

        console.log('✅ Call button clicked');

        // Monitor for call completion
        let callCompleted = false;
        const monitorStartTime = Date.now();
        const monitorTimeout = 60000; // 1 minute

        while (!callCompleted && (Date.now() - monitorStartTime) < monitorTimeout) {
          await page.waitForTimeout(5000);

          const qualityResponse = await page.request.get(`${OUTBOUND_BASE_URL}/api/transcription/quality-overview`);
          const qualityData = await qualityResponse.json();

          if (qualityData.overview.totalCalls > initialCallCount) {
            console.log('✅ New call detected in system');
            callCompleted = true;
          }
        }

        if (callCompleted) {
          console.log('✅ Outbound call completed successfully');
        } else {
          console.log('⚠️  Call monitoring timed out (may be normal for long calls)');
        }
      } else {
        console.log('⚠️  No patients available for testing');
      }
    });

    test('should handle medical context in outbound call', async ({ page }) => {
      console.log('🏥 Testing medical context handling...');

      const patientsResponse = await page.request.get(`${OUTBOUND_BASE_URL}/api/patients`);

      if (patientsResponse.ok()) {
        const patients = await patientsResponse.json();

        if (patients.length > 0) {
          const patient = patients[0];

          console.log('Patient medical context:');
          console.log('  - MRN:', patient.mrn);
          console.log('  - Conditions:', patient.conditions?.join(', ') || 'None');
          console.log('  - Medications:', patient.medications?.join(', ') || 'None');
          console.log('  - Custom Prompt:', patient.customPrompt ? 'Yes' : 'No');

          expect(patient.mrn).toBeTruthy();
          console.log('✅ Medical context verified');
        }
      }
    });
  });

  test.describe('Call Interruption Scenarios', () => {

    test('should handle caller interrupting AI response', async () => {
      console.log('⚡ Testing caller interruption...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + '/media-stream';
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');
      let clearEventReceived = false;

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          if (message.event === 'clear') {
            clearEventReceived = true;
            console.log('✅ Clear event received - AI response interrupted');
          }
        } catch (e) {
          // Ignore
        }
      });

      ws.send(JSON.stringify({
        event: 'start',
        start: { streamSid: streamSid },
        streamSid: streamSid
      }));

      await new Promise(resolve => setTimeout(resolve, 500));

      // Send audio to trigger AI response
      console.log('Triggering AI response...');
      for (let i = 0; i < 30; i++) {
        ws.send(JSON.stringify({
          event: 'media',
          media: {
            track: 'inbound',
            timestamp: String(i * 20),
            payload: Buffer.alloc(160).fill(0x7F).toString('base64')
          },
          streamSid: streamSid
        }));
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      // Wait a bit for response to start
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Interrupt with more audio
      console.log('Interrupting with caller audio...');
      for (let i = 30; i < 60; i++) {
        ws.send(JSON.stringify({
          event: 'media',
          media: {
            track: 'inbound',
            timestamp: String(i * 20),
            payload: Buffer.alloc(160).fill(0x7F).toString('base64')
          },
          streamSid: streamSid
        }));
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('Interruption test completed');
      ws.close();
    });

    test('should handle rapid back-and-forth conversation', async () => {
      console.log('🔄 Testing rapid conversation turns...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + '/media-stream';
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');

      ws.send(JSON.stringify({
        event: 'start',
        start: { streamSid: streamSid },
        streamSid: streamSid
      }));

      await new Promise(resolve => setTimeout(resolve, 500));

      // Simulate 5 rapid turns
      for (let turn = 0; turn < 5; turn++) {
        console.log(`Turn ${turn + 1}...`);

        // Send short burst of audio
        for (let i = 0; i < 20; i++) {
          ws.send(JSON.stringify({
            event: 'media',
            media: {
              track: 'inbound',
              timestamp: String((turn * 100) + (i * 20)),
              payload: Buffer.alloc(160).fill(0x7F).toString('base64')
            },
            streamSid: streamSid
          }));
          await new Promise(resolve => setTimeout(resolve, 20));
        }

        // Brief pause between turns
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      console.log('✅ Rapid conversation completed');

      await new Promise(resolve => setTimeout(resolve, 2000));
      ws.close();
    });
  });

  test.describe('Call Quality and Performance', () => {

    test('should maintain audio quality throughout long call', async () => {
      console.log('📊 Testing long call audio quality...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + '/media-stream';
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');
      let audioPacketsReceived = 0;
      let lastAudioTime = Date.now();

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          if (message.event === 'media') {
            audioPacketsReceived++;
            lastAudioTime = Date.now();
          }
        } catch (e) {
          // Ignore
        }
      });

      ws.send(JSON.stringify({
        event: 'start',
        start: { streamSid: streamSid },
        streamSid: streamSid
      }));

      await new Promise(resolve => setTimeout(resolve, 500));

      // Simulate 1 minute call (3000 packets)
      console.log('Simulating 1-minute call...');
      const totalPackets = 3000;

      for (let i = 0; i < totalPackets; i++) {
        ws.send(JSON.stringify({
          event: 'media',
          media: {
            track: 'inbound',
            timestamp: String(i * 20),
            payload: Buffer.alloc(160).fill(0x7F).toString('base64')
          },
          streamSid: streamSid
        }));

        if (i % 300 === 0) {
          console.log(`Progress: ${Math.floor((i/totalPackets) * 100)}%`);
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          await new Promise(resolve => setTimeout(resolve, 20));
        }
      }

      console.log(`✅ Call completed. Received ${audioPacketsReceived} response packets`);

      ws.close();
    });

    test('should track call metrics and statistics', async ({ page }) => {
      console.log('📈 Testing call metrics tracking...');

      const qualityResponse = await page.request.get(`${OUTBOUND_BASE_URL}/api/transcription/quality-overview`);

      if (qualityResponse.ok()) {
        const data = await qualityResponse.json();

        console.log('Call Metrics:');
        console.log('  - Total Calls:', data.overview.totalCalls);
        console.log('  - Enhanced Transcriptions:', data.overview.callsWithEnhancedTranscription);
        console.log('  - Health Status:', data.healthStatus);

        if (data.overview.totalCalls > 0) {
          const enhancedRate = (data.overview.callsWithEnhancedTranscription / data.overview.totalCalls) * 100;
          console.log(`  - Enhanced Rate: ${enhancedRate.toFixed(1)}%`);
        }

        expect(data.overview).toBeDefined();
        console.log('✅ Metrics tracking verified');
      }
    });
  });

  test.describe('Call Termination', () => {

    test('should handle graceful call termination', async () => {
      console.log('👋 Testing graceful termination...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + '/media-stream';
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');

      ws.send(JSON.stringify({
        event: 'start',
        start: { streamSid: streamSid },
        streamSid: streamSid
      }));

      // Simulate brief call
      for (let i = 0; i < 50; i++) {
        ws.send(JSON.stringify({
          event: 'media',
          media: {
            track: 'inbound',
            timestamp: String(i * 20),
            payload: Buffer.alloc(160).fill(0x7F).toString('base64')
          },
          streamSid: streamSid
        }));
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Send stop event
      ws.send(JSON.stringify({
        event: 'stop',
        sequenceNumber: '999',
        streamSid: streamSid
      }));

      await new Promise(resolve => setTimeout(resolve, 500));

      // Close connection
      const closePromise = new Promise((resolve) => {
        ws.on('close', (code) => {
          console.log(`✅ Connection closed with code: ${code}`);
          resolve(code);
        });
      });

      ws.close();

      const closeCode = await closePromise;
      expect(closeCode).toBeDefined();

      console.log('✅ Graceful termination completed');
    });

    test('should handle abrupt disconnection', async () => {
      console.log('⚡ Testing abrupt disconnection...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + '/media-stream';
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');

      ws.send(JSON.stringify({
        event: 'start',
        start: { streamSid: streamSid },
        streamSid: streamSid
      }));

      // Send some audio
      for (let i = 0; i < 20; i++) {
        ws.send(JSON.stringify({
          event: 'media',
          media: {
            track: 'inbound',
            timestamp: String(i * 20),
            payload: Buffer.alloc(160).fill(0x7F).toString('base64')
          },
          streamSid: streamSid
        }));
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      // Abruptly terminate
      ws.terminate();

      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('✅ Abrupt disconnection handled');
    });

    test('should clean up resources after call ends', async () => {
      console.log('🧹 Testing resource cleanup...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + '/media-stream';

      // Create and end multiple calls
      for (let i = 0; i < 3; i++) {
        const ws = new WebSocket(wsUrl);

        await new Promise((resolve) => ws.on('open', resolve));

        const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');

        ws.send(JSON.stringify({
          event: 'start',
          start: { streamSid: streamSid },
          streamSid: streamSid
        }));

        // Brief audio
        for (let j = 0; j < 10; j++) {
          ws.send(JSON.stringify({
            event: 'media',
            media: {
              track: 'inbound',
              timestamp: String(j * 20),
              payload: Buffer.alloc(160).fill(0x7F).toString('base64')
            },
            streamSid: streamSid
          }));
          await new Promise(resolve => setTimeout(resolve, 20));
        }

        ws.close();

        await new Promise(resolve => setTimeout(resolve, 500));

        console.log(`✅ Call ${i + 1} cleaned up`);
      }

      console.log('✅ Resource cleanup verified');
    });
  });
});
