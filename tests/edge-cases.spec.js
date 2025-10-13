import { test, expect } from '@playwright/test';
import WebSocket from 'ws';
import crypto from 'crypto';

/**
 * Edge Cases and Error Handling Tests
 *
 * Tests unusual scenarios, error conditions, and edge cases:
 * - Malformed data handling
 * - Connection failures
 * - Resource limits
 * - Timing edge cases
 * - Data corruption scenarios
 */

test.describe('Edge Cases and Error Handling', () => {
  const INBOUND_BASE_URL = 'http://localhost:5050';
  const OUTBOUND_BASE_URL = 'http://localhost:5051';
  const MEDIA_STREAM_PATH = '/media-stream';

  test.setTimeout(120000); // 2 minutes for edge case tests

  test.describe('Malformed Data Handling', () => {

    test('should handle completely invalid JSON', async () => {
      console.log('❌ Testing invalid JSON handling...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      // Send various forms of invalid JSON
      const invalidMessages = [
        '{ invalid json',
        'not json at all',
        '{"key": undefined}',
        '{"incomplete":',
        '{]',
        'null',
        '{"event": "media", "media": undefined}',
        '',
        '   ',
        '\n\n',
        '{}[]'
      ];

      for (const msg of invalidMessages) {
        try {
          ws.send(msg);
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (e) {
          console.log('Send error (expected):', e.message);
        }
      }

      // Connection should still be alive
      await new Promise(resolve => setTimeout(resolve, 1000));
      expect(ws.readyState).toBe(WebSocket.OPEN);

      console.log('✅ Connection survived invalid JSON');

      ws.close();
    });

    test('should handle binary data in text frame', async () => {
      console.log('💾 Testing binary data handling...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      // Send binary data (should be text for JSON)
      const binaryData = Buffer.from([0xFF, 0xFE, 0xFD, 0xFC, 0x00, 0x01]);

      try {
        ws.send(binaryData);
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        console.log('Binary send error (may be expected)');
      }

      // Try to continue with valid data
      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');
      ws.send(JSON.stringify({
        event: 'start',
        start: { streamSid: streamSid },
        streamSid: streamSid
      }));

      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('✅ Handled binary data');

      ws.close();
    });

    test('should handle extremely large JSON payloads', async () => {
      console.log('📦 Testing large payload handling...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      // Create an extremely large payload (10MB of base64 data)
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024);
      const largePayload = largeBuffer.toString('base64');

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');

      try {
        ws.send(JSON.stringify({
          event: 'media',
          media: {
            track: 'inbound',
            timestamp: '0',
            payload: largePayload
          },
          streamSid: streamSid
        }));

        console.log('Large payload sent');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.log('Large payload error (expected):', e.message);
      }

      // Connection may or may not survive depending on limits
      console.log('Connection state:', ws.readyState);

      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    test('should handle missing required fields in events', async () => {
      console.log('🔍 Testing missing field handling...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      const incompleteEvents = [
        { event: 'start' }, // Missing start field
        { event: 'media' }, // Missing media field
        { event: 'media', media: {} }, // Missing payload
        { event: 'media', media: { payload: 'abc' } }, // Missing streamSid
        { media: { payload: 'abc' } }, // Missing event type
        {}  // Empty object
      ];

      for (const event of incompleteEvents) {
        ws.send(JSON.stringify(event));
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(ws.readyState).toBe(WebSocket.OPEN);
      console.log('✅ Handled incomplete events gracefully');

      ws.close();
    });

    test('should handle corrupted base64 audio payload', async () => {
      console.log('🔧 Testing corrupted audio handling...');

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

      // Send corrupted base64
      const corruptedPayloads = [
        'not-base64!@#$',
        'SGVsbG8=invalid',
        '!!!',
        'a',
        '',
        '\n\n\n',
        'AAAAAAAA$$$$'
      ];

      for (const payload of corruptedPayloads) {
        ws.send(JSON.stringify({
          event: 'media',
          media: {
            track: 'inbound',
            timestamp: '0',
            payload: payload
          },
          streamSid: streamSid
        }));
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('✅ Handled corrupted payloads');

      ws.close();
    });
  });

  test.describe('Connection Failure Scenarios', () => {

    test('should handle connection during server restart', async () => {
      console.log('🔄 Testing connection persistence...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;

      // Try to connect multiple times
      let successfulConnections = 0;

      for (let i = 0; i < 5; i++) {
        try {
          const ws = new WebSocket(wsUrl);

          const connected = await Promise.race([
            new Promise((resolve) => ws.on('open', () => resolve(true))),
            new Promise((resolve) => setTimeout(() => resolve(false), 5000))
          ]);

          if (connected) {
            successfulConnections++;
            ws.close();
          }

          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) {
          console.log(`Connection ${i + 1} failed (may be normal)`);
        }
      }

      console.log(`✅ ${successfulConnections}/5 connections succeeded`);
      expect(successfulConnections).toBeGreaterThan(0);
    });

    test('should handle network timeout', async () => {
      console.log('⏱️  Testing network timeout...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');

      ws.send(JSON.stringify({
        event: 'start',
        start: { streamSid: streamSid },
        streamSid: streamSid
      }));

      // Send audio and then go silent for extended period
      for (let i = 0; i < 10; i++) {
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

      console.log('Going silent for 30 seconds...');
      await new Promise(resolve => setTimeout(resolve, 30000));

      // Try to send more audio
      ws.send(JSON.stringify({
        event: 'media',
        media: {
          track: 'inbound',
          timestamp: '1000',
          payload: Buffer.alloc(160).fill(0x7F).toString('base64')
        },
        streamSid: streamSid
      }));

      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('Connection state after timeout:', ws.readyState);

      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    test('should handle rapid connect/disconnect cycles', async () => {
      console.log('🔄 Testing rapid connection cycles...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const numCycles = 20;

      for (let i = 0; i < numCycles; i++) {
        const ws = new WebSocket(wsUrl);

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);

          ws.on('open', () => {
            clearTimeout(timeout);
            resolve();
          });

          ws.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });

        // Immediately close
        ws.close();

        if (i % 5 === 0) {
          console.log(`Completed ${i + 1}/${numCycles} cycles`);
        }
      }

      console.log('✅ Rapid connection cycles completed');
    });

    test('should handle OpenAI API failure', async () => {
      console.log('🔧 Testing OpenAI API failure handling...');

      // This test verifies the system continues to accept connections
      // even if OpenAI API might have issues

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');

      ws.send(JSON.stringify({
        event: 'start',
        start: { streamSid: streamSid },
        streamSid: streamSid
      }));

      // Send audio even if OpenAI might fail
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

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Connection should remain stable
      console.log('Connection state:', ws.readyState);

      if (ws.readyState === WebSocket.OPEN) {
        console.log('✅ Connection stable despite potential API issues');
        ws.close();
      } else {
        console.log('⚠️  Connection closed (may indicate API issue)');
      }
    });
  });

  test.describe('Resource Limit Tests', () => {

    test('should handle maximum concurrent connections', async () => {
      console.log('🔗 Testing concurrent connection limits...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const connections = [];
      const maxConnections = 10;

      // Create maximum concurrent connections
      for (let i = 0; i < maxConnections; i++) {
        try {
          const ws = new WebSocket(wsUrl);

          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);

            ws.on('open', () => {
              clearTimeout(timeout);
              connections.push(ws);
              resolve();
            });

            ws.on('error', (error) => {
              clearTimeout(timeout);
              reject(error);
            });
          });

          console.log(`Connection ${i + 1}/${maxConnections} established`);
        } catch (e) {
          console.log(`Connection ${i + 1} failed:`, e.message);
        }
      }

      console.log(`✅ ${connections.length}/${maxConnections} connections established`);

      // Close all
      connections.forEach(ws => ws.close());
      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    test('should handle memory pressure from many audio packets', async () => {
      console.log('💾 Testing memory pressure handling...');

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

      // Send a very large number of packets rapidly
      const numPackets = 5000;

      console.log(`Sending ${numPackets} packets...`);

      for (let i = 0; i < numPackets; i++) {
        ws.send(JSON.stringify({
          event: 'media',
          media: {
            track: 'inbound',
            timestamp: String(i * 20),
            payload: Buffer.alloc(160).fill(0x7F).toString('base64')
          },
          streamSid: streamSid
        }));

        if (i % 500 === 0) {
          console.log(`Progress: ${Math.floor((i / numPackets) * 100)}%`);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log('✅ Memory pressure test completed');

      await new Promise(resolve => setTimeout(resolve, 2000));

      ws.close();
    });

    test('should handle burst traffic', async () => {
      console.log('💥 Testing burst traffic handling...');

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

      // Send bursts of audio with gaps
      for (let burst = 0; burst < 5; burst++) {
        console.log(`Burst ${burst + 1}...`);

        // Send 100 packets as fast as possible
        for (let i = 0; i < 100; i++) {
          ws.send(JSON.stringify({
            event: 'media',
            media: {
              track: 'inbound',
              timestamp: String((burst * 2000) + (i * 20)),
              payload: Buffer.alloc(160).fill(0x7F).toString('base64')
            },
            streamSid: streamSid
          }));
        }

        // Gap between bursts
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log('✅ Burst traffic handled');

      ws.close();
    });
  });

  test.describe('Timing Edge Cases', () => {

    test('should handle out-of-order timestamps', async () => {
      console.log('🔀 Testing out-of-order timestamps...');

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

      // Send timestamps in random order
      const timestamps = [0, 60, 20, 100, 40, 120, 80, 140, 160, 120];

      for (const timestamp of timestamps) {
        ws.send(JSON.stringify({
          event: 'media',
          media: {
            track: 'inbound',
            timestamp: String(timestamp),
            payload: Buffer.alloc(160).fill(0x7F).toString('base64')
          },
          streamSid: streamSid
        }));
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log('✅ Out-of-order timestamps handled');

      ws.close();
    });

    test('should handle duplicate timestamps', async () => {
      console.log('🔄 Testing duplicate timestamps...');

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

      // Send same timestamp multiple times
      for (let i = 0; i < 5; i++) {
        ws.send(JSON.stringify({
          event: 'media',
          media: {
            track: 'inbound',
            timestamp: '100',
            payload: Buffer.alloc(160).fill(0x7F).toString('base64')
          },
          streamSid: streamSid
        }));
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log('✅ Duplicate timestamps handled');

      ws.close();
    });

    test('should handle very large timestamp values', async () => {
      console.log('📊 Testing large timestamp values...');

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

      // Test with very large timestamps
      const largeTimestamps = [
        999999,
        9999999,
        99999999,
        2147483647, // Max 32-bit int
        '999999999999' // String representation
      ];

      for (const timestamp of largeTimestamps) {
        ws.send(JSON.stringify({
          event: 'media',
          media: {
            track: 'inbound',
            timestamp: String(timestamp),
            payload: Buffer.alloc(160).fill(0x7F).toString('base64')
          },
          streamSid: streamSid
        }));
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log('✅ Large timestamps handled');

      ws.close();
    });

    test('should handle negative timestamp values', async () => {
      console.log('➖ Testing negative timestamps...');

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

      // Test with negative timestamps
      const negativeTimestamps = [-100, -1, -9999];

      for (const timestamp of negativeTimestamps) {
        ws.send(JSON.stringify({
          event: 'media',
          media: {
            track: 'inbound',
            timestamp: String(timestamp),
            payload: Buffer.alloc(160).fill(0x7F).toString('base64')
          },
          streamSid: streamSid
        }));
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log('✅ Negative timestamps handled');

      ws.close();
    });
  });

  test.describe('State Transition Edge Cases', () => {

    test('should handle multiple start events', async () => {
      console.log('🔁 Testing multiple start events...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      // Send start event multiple times
      for (let i = 0; i < 3; i++) {
        const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');

        ws.send(JSON.stringify({
          event: 'start',
          start: { streamSid: streamSid },
          streamSid: streamSid
        }));

        await new Promise(resolve => setTimeout(resolve, 500));
        console.log(`Start event ${i + 1} sent`);
      }

      console.log('✅ Multiple start events handled');

      ws.close();
    });

    test('should handle media before start event', async () => {
      console.log('⚠️  Testing media before start...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      // Send media without start event
      ws.send(JSON.stringify({
        event: 'media',
        media: {
          track: 'inbound',
          timestamp: '0',
          payload: Buffer.alloc(160).fill(0x7F).toString('base64')
        }
      }));

      await new Promise(resolve => setTimeout(resolve, 500));

      // Now send start event
      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');

      ws.send(JSON.stringify({
        event: 'start',
        start: { streamSid: streamSid },
        streamSid: streamSid
      }));

      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('✅ Handled media before start');

      ws.close();
    });

    test('should handle stop without start', async () => {
      console.log('⚠️  Testing stop without start...');

      const wsUrl = INBOUND_BASE_URL.replace('http', 'ws') + MEDIA_STREAM_PATH;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => ws.on('open', resolve));

      // Send stop without start
      ws.send(JSON.stringify({
        event: 'stop',
        sequenceNumber: '999',
        streamSid: 'MZ123456'
      }));

      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('✅ Handled stop without start');

      ws.close();
    });
  });
});
