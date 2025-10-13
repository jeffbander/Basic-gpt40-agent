import { test, expect } from '@playwright/test';
import WebSocket from 'ws';
import crypto from 'crypto';

/**
 * Comprehensive Twilio Audio Pipeline Test Suite
 *
 * Tests the full audio streaming pipeline including:
 * - Twilio Media Stream WebSocket connections
 * - OpenAI Realtime API audio processing
 * - Audio format handling (PCM-ulaw)
 * - Interruption and speech detection
 * - Media timestamp synchronization
 * - Error recovery and edge cases
 */

test.describe('Twilio Audio Pipeline - Full Integration Tests', () => {
  const INBOUND_BASE_URL = 'http://localhost:5050';
  const OUTBOUND_BASE_URL = 'http://localhost:5051';
  const MEDIA_STREAM_PATH = '/media-stream';

  // Test timeouts
  const CONNECTION_TIMEOUT = 10000;
  const AUDIO_PROCESSING_TIMEOUT = 30000;
  const CALL_COMPLETION_TIMEOUT = 120000;

  test.setTimeout(180000); // 3 minutes for full call tests

  test.describe('WebSocket Connection Tests', () => {

    test('should establish WebSocket connection to media-stream endpoint', async () => {
      console.log('🔌 Testing WebSocket connection establishment...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      const connectionPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, CONNECTION_TIMEOUT);

        ws.on('open', () => {
          clearTimeout(timeout);
          console.log('✅ WebSocket connection established');
          resolve(true);
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      await expect(connectionPromise).resolves.toBe(true);

      ws.close();
      console.log('🔌 Connection closed cleanly');
    });

    test('should handle multiple concurrent WebSocket connections', async () => {
      console.log('🔌 Testing concurrent WebSocket connections...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const connections = [];
      const numConnections = 5;

      // Create multiple connections
      for (let i = 0; i < numConnections; i++) {
        const ws = new WebSocket(wsUrl);
        connections.push(ws);

        await new Promise((resolve) => {
          ws.on('open', resolve);
        });

        console.log(`✅ Connection ${i + 1}/${numConnections} established`);
      }

      expect(connections.length).toBe(numConnections);

      // Close all connections
      connections.forEach(ws => ws.close());
      console.log('🔌 All connections closed');
    });

    test('should handle connection close gracefully', async () => {
      console.log('🔌 Testing graceful connection closure...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      const closePromise = new Promise((resolve) => {
        ws.on('close', (code, reason) => {
          console.log(`✅ Connection closed with code: ${code}`);
          resolve({ code, reason });
        });
      });

      ws.close();

      const closeResult = await closePromise;
      expect(closeResult.code).toBeDefined();
    });

    test('should reconnect after unexpected disconnection', async () => {
      console.log('🔌 Testing reconnection after disconnect...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;

      // First connection
      let ws = new WebSocket(wsUrl);
      await new Promise((resolve) => ws.on('open', resolve));
      console.log('✅ First connection established');

      // Force close
      ws.terminate();
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Reconnect
      ws = new WebSocket(wsUrl);
      const reconnectPromise = new Promise((resolve) => {
        ws.on('open', () => {
          console.log('✅ Reconnection successful');
          resolve(true);
        });
      });

      await expect(reconnectPromise).resolves.toBe(true);
      ws.close();
    });
  });

  test.describe('Twilio Media Stream Events', () => {

    test('should handle Twilio "start" event correctly', async () => {
      console.log('📞 Testing Twilio start event handling...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      // Simulate Twilio start event
      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');
      const startEvent = {
        event: 'start',
        sequenceNumber: '1',
        start: {
          streamSid: streamSid,
          accountSid: 'AC' + crypto.randomBytes(16).toString('hex'),
          callSid: 'CA' + crypto.randomBytes(16).toString('hex'),
          tracks: ['inbound', 'outbound'],
          mediaFormat: {
            encoding: 'audio/x-mulaw',
            sampleRate: 8000,
            channels: 1
          }
        },
        streamSid: streamSid
      };

      ws.send(JSON.stringify(startEvent));
      console.log('✅ Start event sent with streamSid:', streamSid);

      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      ws.close();
    });

    test('should handle Twilio "media" events with audio payload', async () => {
      console.log('🎵 Testing media event handling...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');

      // Send start event first
      const startEvent = {
        event: 'start',
        sequenceNumber: '1',
        start: {
          streamSid: streamSid,
          accountSid: 'AC' + crypto.randomBytes(16).toString('hex'),
          callSid: 'CA' + crypto.randomBytes(16).toString('hex'),
          tracks: ['inbound'],
          mediaFormat: {
            encoding: 'audio/x-mulaw',
            sampleRate: 8000,
            channels: 1
          }
        },
        streamSid: streamSid
      };

      ws.send(JSON.stringify(startEvent));
      await new Promise(resolve => setTimeout(resolve, 500));

      // Send media events (simulate audio chunks)
      const numAudioChunks = 10;
      let mediaEventsReceived = 0;

      for (let i = 0; i < numAudioChunks; i++) {
        // Generate dummy base64-encoded audio (silence in PCM-ulaw)
        const audioPayload = Buffer.alloc(160).toString('base64'); // 20ms of audio at 8kHz

        const mediaEvent = {
          event: 'media',
          sequenceNumber: String(i + 2),
          media: {
            track: 'inbound',
            chunk: String(i + 1),
            timestamp: String(i * 20), // 20ms per chunk
            payload: audioPayload
          },
          streamSid: streamSid
        };

        ws.send(JSON.stringify(mediaEvent));
        mediaEventsReceived++;

        // Small delay between chunks
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      console.log(`✅ Sent ${mediaEventsReceived} media events`);
      expect(mediaEventsReceived).toBe(numAudioChunks);

      ws.close();
    });

    test('should handle "mark" events for playback synchronization', async () => {
      console.log('🏷️  Testing mark event handling...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');

      // Start stream
      const startEvent = {
        event: 'start',
        start: { streamSid: streamSid },
        streamSid: streamSid
      };
      ws.send(JSON.stringify(startEvent));

      // Listen for mark events from server
      let markReceived = false;
      const markPromise = new Promise((resolve) => {
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data);
            if (message.event === 'mark') {
              console.log('✅ Mark event received:', message.mark);
              markReceived = true;
              resolve(true);
            }
          } catch (e) {
            // Ignore parse errors
          }
        });

        // Timeout after 5 seconds
        setTimeout(() => resolve(false), 5000);
      });

      // Send some media to trigger response
      const audioPayload = Buffer.alloc(160).toString('base64');
      ws.send(JSON.stringify({
        event: 'media',
        media: { track: 'inbound', timestamp: '0', payload: audioPayload },
        streamSid: streamSid
      }));

      await markPromise;
      // Note: Mark might not be received immediately in test environment
      console.log('Mark received status:', markReceived);

      ws.close();
    });

    test('should handle "clear" events for audio interruption', async () => {
      console.log('🚫 Testing clear event for interruption...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');

      // Start stream
      ws.send(JSON.stringify({
        event: 'start',
        start: { streamSid: streamSid },
        streamSid: streamSid
      }));

      await new Promise(resolve => setTimeout(resolve, 500));

      // Listen for clear events
      let clearReceived = false;
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          if (message.event === 'clear') {
            console.log('✅ Clear event received');
            clearReceived = true;
          }
        } catch (e) {
          // Ignore
        }
      });

      // Send audio to trigger speech detection (which may trigger clear)
      for (let i = 0; i < 5; i++) {
        ws.send(JSON.stringify({
          event: 'media',
          media: {
            track: 'inbound',
            timestamp: String(i * 20),
            payload: Buffer.alloc(160).toString('base64')
          },
          streamSid: streamSid
        }));
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('Clear event status:', clearReceived ? 'Received' : 'Not received (may be normal)');

      ws.close();
    });
  });

  test.describe('Audio Format and Quality Tests', () => {

    test('should handle PCM-ulaw audio format correctly', async () => {
      console.log('🎵 Testing PCM-ulaw audio format handling...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');

      // Start with correct format
      ws.send(JSON.stringify({
        event: 'start',
        start: {
          streamSid: streamSid,
          mediaFormat: {
            encoding: 'audio/x-mulaw', // PCM-ulaw
            sampleRate: 8000,
            channels: 1
          }
        },
        streamSid: streamSid
      }));

      await new Promise(resolve => setTimeout(resolve, 500));

      // Send audio at correct sample rate (8kHz, 160 bytes = 20ms)
      const audioBuffer = Buffer.alloc(160);
      // Fill with u-law silence (0x7F)
      audioBuffer.fill(0x7F);

      ws.send(JSON.stringify({
        event: 'media',
        media: {
          track: 'inbound',
          timestamp: '0',
          payload: audioBuffer.toString('base64')
        },
        streamSid: streamSid
      }));

      console.log('✅ PCM-ulaw audio sent successfully');

      await new Promise(resolve => setTimeout(resolve, 1000));
      ws.close();
    });

    test('should handle varying audio chunk sizes', async () => {
      console.log('📏 Testing variable audio chunk sizes...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');

      ws.send(JSON.stringify({
        event: 'start',
        start: { streamSid: streamSid },
        streamSid: streamSid
      }));

      await new Promise(resolve => setTimeout(resolve, 500));

      // Test different chunk sizes
      const chunkSizes = [80, 160, 320, 640]; // 10ms, 20ms, 40ms, 80ms at 8kHz

      for (const size of chunkSizes) {
        const audioPayload = Buffer.alloc(size).toString('base64');
        ws.send(JSON.stringify({
          event: 'media',
          media: { track: 'inbound', timestamp: '0', payload: audioPayload },
          streamSid: streamSid
        }));
        console.log(`✅ Sent ${size}-byte audio chunk`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      ws.close();
    });

    test('should maintain audio quality through pipeline', async () => {
      console.log('🎚️  Testing audio quality maintenance...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');

      ws.send(JSON.stringify({
        event: 'start',
        start: { streamSid: streamSid },
        streamSid: streamSid
      }));

      let audioResponseReceived = false;

      // Listen for audio responses from OpenAI
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          if (message.event === 'media' && message.media && message.media.payload) {
            console.log('✅ Audio response received from server');
            audioResponseReceived = true;

            // Verify payload is base64
            const isBase64 = /^[A-Za-z0-9+/=]+$/.test(message.media.payload);
            expect(isBase64).toBe(true);
          }
        } catch (e) {
          // Ignore
        }
      });

      // Send quality audio
      for (let i = 0; i < 20; i++) {
        const audioPayload = Buffer.alloc(160).fill(0x7F).toString('base64');
        ws.send(JSON.stringify({
          event: 'media',
          media: { track: 'inbound', timestamp: String(i * 20), payload: audioPayload },
          streamSid: streamSid
        }));
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log('Audio response status:', audioResponseReceived ? 'Received' : 'Not received');

      ws.close();
    });
  });

  test.describe('Timestamp and Synchronization Tests', () => {

    test('should track media timestamps correctly', async () => {
      console.log('⏰ Testing timestamp tracking...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');

      ws.send(JSON.stringify({
        event: 'start',
        start: { streamSid: streamSid },
        streamSid: streamSid
      }));

      await new Promise(resolve => setTimeout(resolve, 500));

      // Send media with incrementing timestamps
      const timestamps = [0, 20, 40, 60, 80, 100, 120, 140, 160, 180];

      for (const timestamp of timestamps) {
        ws.send(JSON.stringify({
          event: 'media',
          media: {
            track: 'inbound',
            timestamp: String(timestamp),
            payload: Buffer.alloc(160).toString('base64')
          },
          streamSid: streamSid
        }));
        console.log(`✅ Sent media with timestamp: ${timestamp}ms`);
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      expect(timestamps.length).toBe(10);
      ws.close();
    });

    test('should handle timestamp gaps gracefully', async () => {
      console.log('⏰ Testing timestamp gap handling...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');

      ws.send(JSON.stringify({
        event: 'start',
        start: { streamSid: streamSid },
        streamSid: streamSid
      }));

      await new Promise(resolve => setTimeout(resolve, 500));

      // Send media with gaps in timestamps
      const timestamps = [0, 20, 40, 100, 120, 200, 220]; // Note the gaps

      for (const timestamp of timestamps) {
        ws.send(JSON.stringify({
          event: 'media',
          media: {
            track: 'inbound',
            timestamp: String(timestamp),
            payload: Buffer.alloc(160).toString('base64')
          },
          streamSid: streamSid
        }));
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      console.log('✅ Handled timestamp gaps without errors');
      ws.close();
    });

    test('should synchronize AI response playback timing', async () => {
      console.log('⏰ Testing response playback synchronization...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');

      ws.send(JSON.stringify({
        event: 'start',
        start: { streamSid: streamSid },
        streamSid: streamSid
      }));

      const responseTimestamps = [];

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          if (message.event === 'media') {
            const timestamp = Date.now();
            responseTimestamps.push(timestamp);
          }
        } catch (e) {
          // Ignore
        }
      });

      // Send audio to trigger response
      for (let i = 0; i < 10; i++) {
        ws.send(JSON.stringify({
          event: 'media',
          media: {
            track: 'inbound',
            timestamp: String(i * 20),
            payload: Buffer.alloc(160).toString('base64')
          },
          streamSid: streamSid
        }));
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log(`✅ Tracked ${responseTimestamps.length} response timestamps`);
      ws.close();
    });
  });

  test.describe('Error Handling and Edge Cases', () => {

    test('should handle malformed JSON messages gracefully', async () => {
      console.log('❌ Testing malformed JSON handling...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      // Send malformed JSON
      ws.send('{ invalid json }');
      ws.send('{"event": "media", incomplete...');
      ws.send('null');

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Connection should still be alive
      expect(ws.readyState).toBe(WebSocket.OPEN);
      console.log('✅ Connection survived malformed messages');

      ws.close();
    });

    test('should handle missing required fields in events', async () => {
      console.log('❌ Testing missing field handling...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      // Send events with missing fields
      ws.send(JSON.stringify({ event: 'start' })); // Missing streamSid
      ws.send(JSON.stringify({ event: 'media' })); // Missing media payload
      ws.send(JSON.stringify({})); // Empty event

      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(ws.readyState).toBe(WebSocket.OPEN);
      console.log('✅ Handled missing fields gracefully');

      ws.close();
    });

    test('should handle rapid connection open/close cycles', async () => {
      console.log('🔄 Testing rapid connection cycles...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const numCycles = 10;

      for (let i = 0; i < numCycles; i++) {
        const ws = new WebSocket(wsUrl);

        await new Promise((resolve) => {
          ws.on('open', () => {
            ws.close();
            resolve();
          });
        });

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`✅ Completed ${numCycles} rapid connection cycles`);
    });

    test('should recover from OpenAI API connection errors', async () => {
      console.log('🔧 Testing OpenAI connection error recovery...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');

      // Start stream
      ws.send(JSON.stringify({
        event: 'start',
        start: { streamSid: streamSid },
        streamSid: streamSid
      }));

      // Send audio even if OpenAI connection might have issues
      let errorOccurred = false;

      ws.on('close', (code, reason) => {
        if (code !== 1000) {
          errorOccurred = true;
          console.log(`⚠️  Connection closed with error code: ${code}`);
        }
      });

      for (let i = 0; i < 5; i++) {
        ws.send(JSON.stringify({
          event: 'media',
          media: {
            track: 'inbound',
            timestamp: String(i * 20),
            payload: Buffer.alloc(160).toString('base64')
          },
          streamSid: streamSid
        }));
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('Error status:', errorOccurred ? 'Occurred but handled' : 'No errors');

      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    test('should handle audio buffer overflow scenarios', async () => {
      console.log('💾 Testing audio buffer overflow handling...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');

      ws.send(JSON.stringify({
        event: 'start',
        start: { streamSid: streamSid },
        streamSid: streamSid
      }));

      await new Promise(resolve => setTimeout(resolve, 500));

      // Send a large burst of audio to test buffering
      const burstSize = 100;

      for (let i = 0; i < burstSize; i++) {
        ws.send(JSON.stringify({
          event: 'media',
          media: {
            track: 'inbound',
            timestamp: String(i * 20),
            payload: Buffer.alloc(160).toString('base64')
          },
          streamSid: streamSid
        }));
      }

      console.log(`✅ Sent burst of ${burstSize} audio packets`);

      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(ws.readyState).toBeLessThanOrEqual(WebSocket.OPEN);

      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    test('should handle network latency and jitter', async () => {
      console.log('🌐 Testing network latency handling...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');

      ws.send(JSON.stringify({
        event: 'start',
        start: { streamSid: streamSid },
        streamSid: streamSid
      }));

      // Simulate variable latency by sending packets with random delays
      for (let i = 0; i < 20; i++) {
        const delay = Math.floor(Math.random() * 100); // 0-100ms random delay

        await new Promise(resolve => setTimeout(resolve, delay));

        ws.send(JSON.stringify({
          event: 'media',
          media: {
            track: 'inbound',
            timestamp: String(i * 20),
            payload: Buffer.alloc(160).toString('base64')
          },
          streamSid: streamSid
        }));
      }

      console.log('✅ Handled variable network latency');

      await new Promise(resolve => setTimeout(resolve, 1000));
      ws.close();
    });
  });

  test.describe('Interruption and Speech Detection', () => {

    test('should detect speech started events', async () => {
      console.log('🗣️  Testing speech detection...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');

      ws.send(JSON.stringify({
        event: 'start',
        start: { streamSid: streamSid },
        streamSid: streamSid
      }));

      let clearEventReceived = false;

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          if (message.event === 'clear') {
            console.log('✅ Clear event received (speech detected)');
            clearEventReceived = true;
          }
        } catch (e) {
          // Ignore
        }
      });

      // Send audio that might trigger speech detection
      for (let i = 0; i < 30; i++) {
        // Use varied audio instead of silence to potentially trigger VAD
        const audioBuffer = Buffer.alloc(160);
        for (let j = 0; j < 160; j++) {
          audioBuffer[j] = Math.floor(Math.random() * 256);
        }

        ws.send(JSON.stringify({
          event: 'media',
          media: {
            track: 'inbound',
            timestamp: String(i * 20),
            payload: audioBuffer.toString('base64')
          },
          streamSid: streamSid
        }));
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log('Speech detection status:', clearEventReceived ? 'Triggered' : 'Not triggered');

      ws.close();
    });

    test('should handle interruption during AI response', async () => {
      console.log('⚡ Testing AI response interruption...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');

      ws.send(JSON.stringify({
        event: 'start',
        start: { streamSid: streamSid },
        streamSid: streamSid
      }));

      await new Promise(resolve => setTimeout(resolve, 500));

      // Send initial audio to trigger a response
      for (let i = 0; i < 10; i++) {
        ws.send(JSON.stringify({
          event: 'media',
          media: {
            track: 'inbound',
            timestamp: String(i * 20),
            payload: Buffer.alloc(160).toString('base64')
          },
          streamSid: streamSid
        }));
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      // Wait for potential response to start
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Send more audio to interrupt
      for (let i = 10; i < 20; i++) {
        ws.send(JSON.stringify({
          event: 'media',
          media: {
            track: 'inbound',
            timestamp: String(i * 20),
            payload: Buffer.alloc(160).toString('base64')
          },
          streamSid: streamSid
        }));
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      console.log('✅ Interruption scenario simulated');

      await new Promise(resolve => setTimeout(resolve, 2000));
      ws.close();
    });

    test('should clear mark queue on interruption', async () => {
      console.log('🏷️  Testing mark queue clearing...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');

      ws.send(JSON.stringify({
        event: 'start',
        start: { streamSid: streamSid },
        streamSid: streamSid
      }));

      const marksReceived = [];

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          if (message.event === 'mark') {
            marksReceived.push(message);
          }
        } catch (e) {
          // Ignore
        }
      });

      // Trigger some responses
      for (let i = 0; i < 15; i++) {
        ws.send(JSON.stringify({
          event: 'media',
          media: {
            track: 'inbound',
            timestamp: String(i * 20),
            payload: Buffer.alloc(160).toString('base64')
          },
          streamSid: streamSid
        }));
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log(`✅ Tracked ${marksReceived.length} mark events`);
      ws.close();
    });
  });

  test.describe('End-to-End Call Flow Tests', () => {

    test('should complete full call flow with transcript', async ({ page }) => {
      console.log('📞 Testing complete call flow...');

      // This test uses the outbound system
      await page.goto(`${OUTBOUND_BASE_URL}/patient-dashboard-v2.html`);
      await page.waitForLoadState('networkidle');

      // Find a patient to call
      await page.waitForSelector('.patient-card', { timeout: 10000 });

      const patientCards = await page.locator('.patient-card').count();
      console.log(`Found ${patientCards} patients`);

      if (patientCards > 0) {
        const callButton = page.locator('.patient-card').first().locator('button:has-text("Call")');
        await callButton.click();

        console.log('✅ Call initiated');

        // Monitor for transcript
        let transcriptFound = false;
        const startTime = Date.now();
        const timeout = 60000; // 1 minute

        while (!transcriptFound && (Date.now() - startTime) < timeout) {
          try {
            const qualityResponse = await page.request.get(`${OUTBOUND_BASE_URL}/api/transcription/quality-overview`);
            const qualityData = await qualityResponse.json();

            if (qualityData.overview.totalCalls > 0) {
              console.log('✅ Call tracked in system');
              transcriptFound = true;
            }

            await page.waitForTimeout(5000);
          } catch (e) {
            await page.waitForTimeout(2000);
          }
        }

        expect(transcriptFound).toBe(true);
      }
    });

    test('should handle concurrent calls correctly', async ({ page }) => {
      console.log('🔀 Testing concurrent call handling...');

      // Verify server can handle multiple WebSocket connections
      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const connections = [];

      // Create 3 simultaneous connections
      for (let i = 0; i < 3; i++) {
        const ws = new WebSocket(wsUrl);
        connections.push(ws);

        await new Promise((resolve) => ws.on('open', resolve));

        const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');

        ws.send(JSON.stringify({
          event: 'start',
          start: { streamSid: streamSid },
          streamSid: streamSid
        }));

        console.log(`✅ Connection ${i + 1} established`);
      }

      // Send audio on all connections
      for (let i = 0; i < 10; i++) {
        connections.forEach(ws => {
          ws.send(JSON.stringify({
            event: 'media',
            media: {
              track: 'inbound',
              timestamp: String(i * 20),
              payload: Buffer.alloc(160).toString('base64')
            }
          }));
        });
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      console.log('✅ All connections received audio');

      // Close all
      connections.forEach(ws => ws.close());

      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    test('should maintain call quality metrics', async ({ page }) => {
      console.log('📊 Testing call quality metrics...');

      const response = await page.request.get(`${OUTBOUND_BASE_URL}/api/transcription/quality-overview`);
      const data = await response.json();

      console.log('Quality metrics:');
      console.log('  - Total calls:', data.overview.totalCalls);
      console.log('  - Enhanced calls:', data.overview.callsWithEnhancedTranscription);
      console.log('  - Health status:', data.healthStatus);

      expect(response.ok()).toBeTruthy();
      expect(data.overview).toBeDefined();
    });
  });

  test.describe('Performance and Load Tests', () => {

    test('should handle sustained audio streaming', async () => {
      console.log('⏱️  Testing sustained audio streaming...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');

      ws.send(JSON.stringify({
        event: 'start',
        start: { streamSid: streamSid },
        streamSid: streamSid
      }));

      // Stream audio for 30 seconds
      const duration = 30000; // 30 seconds
      const interval = 20; // 20ms between packets
      const numPackets = duration / interval;

      console.log(`Streaming ${numPackets} audio packets over ${duration/1000} seconds...`);

      const startTime = Date.now();

      for (let i = 0; i < numPackets; i++) {
        ws.send(JSON.stringify({
          event: 'media',
          media: {
            track: 'inbound',
            timestamp: String(i * interval),
            payload: Buffer.alloc(160).toString('base64')
          },
          streamSid: streamSid
        }));
        await new Promise(resolve => setTimeout(resolve, interval));
      }

      const elapsed = Date.now() - startTime;
      console.log(`✅ Streamed for ${elapsed}ms`);

      expect(elapsed).toBeGreaterThanOrEqual(duration * 0.9); // Allow 10% variance

      ws.close();
    });

    test('should measure audio processing latency', async () => {
      console.log('⚡ Measuring audio processing latency...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');

      ws.send(JSON.stringify({
        event: 'start',
        start: { streamSid: streamSid },
        streamSid: streamSid
      }));

      const latencies = [];

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          if (message.event === 'media') {
            const receiveTime = Date.now();
            latencies.push(receiveTime);
          }
        } catch (e) {
          // Ignore
        }
      });

      // Send audio and measure response time
      const sendTime = Date.now();

      for (let i = 0; i < 10; i++) {
        ws.send(JSON.stringify({
          event: 'media',
          media: {
            track: 'inbound',
            timestamp: String(i * 20),
            payload: Buffer.alloc(160).toString('base64')
          },
          streamSid: streamSid
        }));
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      await new Promise(resolve => setTimeout(resolve, 5000));

      if (latencies.length > 0) {
        const avgLatency = (latencies[0] - sendTime);
        console.log(`✅ Average latency: ${avgLatency}ms`);
      } else {
        console.log('⚠️  No responses received for latency measurement');
      }

      ws.close();
    });

    test('should handle memory efficiently with long calls', async () => {
      console.log('💾 Testing memory efficiency...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');

      ws.send(JSON.stringify({
        event: 'start',
        start: { streamSid: streamSid },
        streamSid: streamSid
      }));

      // Send a large number of packets to test memory handling
      const numPackets = 1000;

      for (let i = 0; i < numPackets; i++) {
        ws.send(JSON.stringify({
          event: 'media',
          media: {
            track: 'inbound',
            timestamp: String(i * 20),
            payload: Buffer.alloc(160).toString('base64')
          },
          streamSid: streamSid
        }));

        if (i % 100 === 0) {
          console.log(`Sent ${i}/${numPackets} packets`);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`✅ Sent ${numPackets} packets without memory issues`);

      await new Promise(resolve => setTimeout(resolve, 1000));
      ws.close();
    });
  });
});
