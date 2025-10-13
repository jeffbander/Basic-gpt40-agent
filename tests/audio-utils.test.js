import { test, expect } from '@playwright/test';
import crypto from 'crypto';

/**
 * Audio Utilities and Format Testing
 *
 * Tests audio buffer handling, format conversions, and utilities
 * for the Twilio audio pipeline
 */

test.describe('Audio Buffer and Format Utilities', () => {

  test.describe('PCM-ulaw Format Tests', () => {

    test('should create valid PCM-ulaw silence buffer', () => {
      console.log('🎵 Testing PCM-ulaw silence generation...');

      // PCM-ulaw silence value is 0xFF (255) or 0x7F (127)
      const silenceBuffer = Buffer.alloc(160);
      silenceBuffer.fill(0x7F);

      expect(silenceBuffer.length).toBe(160);
      expect(silenceBuffer[0]).toBe(0x7F);
      expect(silenceBuffer[159]).toBe(0x7F);

      // Verify it's base64 encodable
      const base64 = silenceBuffer.toString('base64');
      expect(base64).toBeTruthy();
      expect(base64.length).toBeGreaterThan(0);

      console.log('✅ PCM-ulaw silence buffer valid');
    });

    test('should calculate correct buffer size for duration', () => {
      console.log('📏 Testing buffer size calculations...');

      // 8kHz sample rate = 8000 samples per second
      // PCM-ulaw = 1 byte per sample
      // So 20ms = 8000 * 0.020 = 160 bytes

      const durations = [
        { ms: 20, bytes: 160 },
        { ms: 10, bytes: 80 },
        { ms: 40, bytes: 320 },
        { ms: 100, bytes: 800 },
      ];

      durations.forEach(({ ms, bytes }) => {
        const calculatedBytes = Math.floor(8000 * (ms / 1000));
        expect(calculatedBytes).toBe(bytes);
        console.log(`✅ ${ms}ms = ${bytes} bytes`);
      });
    });

    test('should validate audio buffer sizes', () => {
      console.log('✅ Testing audio buffer validation...');

      const validSizes = [80, 160, 320, 640]; // 10ms, 20ms, 40ms, 80ms
      const invalidSizes = [0, 1, 159, 161, 1000, -1];

      validSizes.forEach(size => {
        const buffer = Buffer.alloc(size);
        expect(buffer.length).toBe(size);
        expect(buffer.length % 80).toBe(0); // Should be multiple of 10ms
        console.log(`✅ Valid size: ${size} bytes`);
      });

      invalidSizes.forEach(size => {
        if (size < 0) {
          expect(() => Buffer.alloc(size)).toThrow();
        } else if (size === 0) {
          const buffer = Buffer.alloc(size);
          expect(buffer.length).toBe(0);
        } else {
          const buffer = Buffer.alloc(size);
          // These are valid buffers but may not align with standard chunk sizes
          expect(buffer.length).toBe(size);
        }
      });
    });

    test('should convert between buffer and base64', () => {
      console.log('🔄 Testing buffer/base64 conversion...');

      const originalBuffer = Buffer.alloc(160);
      for (let i = 0; i < 160; i++) {
        originalBuffer[i] = i % 256;
      }

      // Convert to base64
      const base64 = originalBuffer.toString('base64');
      expect(base64).toBeTruthy();
      expect(typeof base64).toBe('string');

      // Convert back
      const decodedBuffer = Buffer.from(base64, 'base64');
      expect(decodedBuffer.length).toBe(originalBuffer.length);

      // Verify data integrity
      for (let i = 0; i < 160; i++) {
        expect(decodedBuffer[i]).toBe(originalBuffer[i]);
      }

      console.log('✅ Conversion maintains data integrity');
    });

    test('should handle audio buffer concatenation', () => {
      console.log('🔗 Testing buffer concatenation...');

      const buffer1 = Buffer.alloc(160).fill(0x7F);
      const buffer2 = Buffer.alloc(160).fill(0xFF);
      const buffer3 = Buffer.alloc(160).fill(0x00);

      const combined = Buffer.concat([buffer1, buffer2, buffer3]);

      expect(combined.length).toBe(480);
      expect(combined[0]).toBe(0x7F);
      expect(combined[160]).toBe(0xFF);
      expect(combined[320]).toBe(0x00);

      console.log('✅ Buffer concatenation works correctly');
    });

    test('should slice audio buffers correctly', () => {
      console.log('✂️  Testing buffer slicing...');

      const buffer = Buffer.alloc(320);
      for (let i = 0; i < 320; i++) {
        buffer[i] = i % 256;
      }

      const slice1 = buffer.slice(0, 160);
      const slice2 = buffer.slice(160, 320);

      expect(slice1.length).toBe(160);
      expect(slice2.length).toBe(160);
      expect(slice1[0]).toBe(0);
      expect(slice2[0]).toBe(160);

      console.log('✅ Buffer slicing works correctly');
    });
  });

  test.describe('Timestamp Calculations', () => {

    test('should calculate correct timestamps for audio chunks', () => {
      console.log('⏰ Testing timestamp calculations...');

      const chunkSizeMs = 20; // 20ms per chunk
      const timestamps = [];

      for (let i = 0; i < 10; i++) {
        timestamps.push(i * chunkSizeMs);
      }

      expect(timestamps).toEqual([0, 20, 40, 60, 80, 100, 120, 140, 160, 180]);
      console.log('✅ Timestamp sequence correct');
    });

    test('should calculate elapsed time between timestamps', () => {
      console.log('⏱️  Testing elapsed time calculation...');

      const startTimestamp = 100;
      const endTimestamp = 500;
      const elapsed = endTimestamp - startTimestamp;

      expect(elapsed).toBe(400);
      console.log(`✅ Elapsed time: ${elapsed}ms`);
    });

    test('should handle timestamp wraparound', () => {
      console.log('🔄 Testing timestamp wraparound...');

      // Simulate timestamp overflow (unlikely but possible)
      const maxTimestamp = 2147483647; // Max 32-bit signed int
      const timestamps = [
        maxTimestamp - 100,
        maxTimestamp - 80,
        maxTimestamp - 60,
        maxTimestamp - 40,
        maxTimestamp - 20,
        maxTimestamp
      ];

      // Calculate intervals
      const intervals = [];
      for (let i = 1; i < timestamps.length; i++) {
        intervals.push(timestamps[i] - timestamps[i-1]);
      }

      intervals.forEach(interval => {
        expect(interval).toBe(20);
      });

      console.log('✅ Timestamp calculations handle large values');
    });

    test('should convert timestamp to human readable format', () => {
      console.log('🕐 Testing timestamp formatting...');

      const timestamps = {
        0: '0ms',
        100: '100ms',
        1000: '1.0s',
        5000: '5.0s',
        60000: '1m 0s',
        125000: '2m 5s'
      };

      Object.entries(timestamps).forEach(([ms, expected]) => {
        const msNum = parseInt(ms);
        let formatted;

        if (msNum < 1000) {
          formatted = `${msNum}ms`;
        } else if (msNum < 60000) {
          formatted = `${(msNum / 1000).toFixed(1)}s`;
        } else {
          const minutes = Math.floor(msNum / 60000);
          const seconds = Math.floor((msNum % 60000) / 1000);
          formatted = `${minutes}m ${seconds}s`;
        }

        expect(formatted).toBe(expected);
        console.log(`✅ ${ms}ms -> ${formatted}`);
      });
    });
  });

  test.describe('Audio Stream Event Builders', () => {

    test('should build valid Twilio start event', () => {
      console.log('🏁 Testing start event builder...');

      const buildStartEvent = (streamSid) => {
        return {
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
      };

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');
      const event = buildStartEvent(streamSid);

      expect(event.event).toBe('start');
      expect(event.start.streamSid).toBe(streamSid);
      expect(event.start.mediaFormat.encoding).toBe('audio/x-mulaw');
      expect(event.start.mediaFormat.sampleRate).toBe(8000);

      // Verify it's JSON serializable
      const json = JSON.stringify(event);
      const parsed = JSON.parse(json);
      expect(parsed.event).toBe('start');

      console.log('✅ Start event valid');
    });

    test('should build valid Twilio media event', () => {
      console.log('🎵 Testing media event builder...');

      const buildMediaEvent = (streamSid, timestamp, audioPayload) => {
        return {
          event: 'media',
          sequenceNumber: String(Math.floor(timestamp / 20) + 2),
          media: {
            track: 'inbound',
            chunk: String(Math.floor(timestamp / 20) + 1),
            timestamp: String(timestamp),
            payload: audioPayload
          },
          streamSid: streamSid
        };
      };

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');
      const audioBuffer = Buffer.alloc(160).fill(0x7F);
      const audioPayload = audioBuffer.toString('base64');
      const event = buildMediaEvent(streamSid, 100, audioPayload);

      expect(event.event).toBe('media');
      expect(event.media.timestamp).toBe('100');
      expect(event.media.payload).toBe(audioPayload);
      expect(event.streamSid).toBe(streamSid);

      console.log('✅ Media event valid');
    });

    test('should build valid Twilio mark event', () => {
      console.log('🏷️  Testing mark event builder...');

      const buildMarkEvent = (streamSid, markName = 'responsePart') => {
        return {
          event: 'mark',
          streamSid: streamSid,
          mark: {
            name: markName
          }
        };
      };

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');
      const event = buildMarkEvent(streamSid);

      expect(event.event).toBe('mark');
      expect(event.streamSid).toBe(streamSid);
      expect(event.mark.name).toBe('responsePart');

      console.log('✅ Mark event valid');
    });

    test('should build valid Twilio clear event', () => {
      console.log('🚫 Testing clear event builder...');

      const buildClearEvent = (streamSid) => {
        return {
          event: 'clear',
          streamSid: streamSid
        };
      };

      const streamSid = 'MZ' + crypto.randomBytes(16).toString('hex');
      const event = buildClearEvent(streamSid);

      expect(event.event).toBe('clear');
      expect(event.streamSid).toBe(streamSid);

      console.log('✅ Clear event valid');
    });
  });

  test.describe('OpenAI Realtime API Event Builders', () => {

    test('should build valid session.update event', () => {
      console.log('⚙️  Testing session.update builder...');

      const buildSessionUpdate = (systemMessage, voice = 'alloy') => {
        return {
          type: 'session.update',
          session: {
            type: 'realtime',
            model: 'gpt-realtime',
            output_modalities: ['audio'],
            audio: {
              input: {
                format: { type: 'audio/pcmu' },
                turn_detection: { type: 'server_vad' }
              },
              output: {
                format: { type: 'audio/pcmu' },
                voice: voice
              }
            },
            instructions: systemMessage
          }
        };
      };

      const event = buildSessionUpdate('You are a helpful assistant', 'shimmer');

      expect(event.type).toBe('session.update');
      expect(event.session.model).toBe('gpt-realtime');
      expect(event.session.audio.output.voice).toBe('shimmer');
      expect(event.session.instructions).toBe('You are a helpful assistant');

      console.log('✅ Session update event valid');
    });

    test('should build valid input_audio_buffer.append event', () => {
      console.log('🎵 Testing audio append builder...');

      const buildAudioAppend = (audioBase64) => {
        return {
          type: 'input_audio_buffer.append',
          audio: audioBase64
        };
      };

      const audioBuffer = Buffer.alloc(160).fill(0x7F);
      const audioBase64 = audioBuffer.toString('base64');
      const event = buildAudioAppend(audioBase64);

      expect(event.type).toBe('input_audio_buffer.append');
      expect(event.audio).toBe(audioBase64);

      console.log('✅ Audio append event valid');
    });

    test('should build valid conversation.item.truncate event', () => {
      console.log('✂️  Testing truncate event builder...');

      const buildTruncateEvent = (itemId, audioEndMs) => {
        return {
          type: 'conversation.item.truncate',
          item_id: itemId,
          content_index: 0,
          audio_end_ms: audioEndMs
        };
      };

      const itemId = 'item_' + crypto.randomBytes(8).toString('hex');
      const event = buildTruncateEvent(itemId, 450);

      expect(event.type).toBe('conversation.item.truncate');
      expect(event.item_id).toBe(itemId);
      expect(event.audio_end_ms).toBe(450);

      console.log('✅ Truncate event valid');
    });

    test('should build valid response.create event', () => {
      console.log('💬 Testing response.create builder...');

      const buildResponseCreate = () => {
        return {
          type: 'response.create'
        };
      };

      const event = buildResponseCreate();

      expect(event.type).toBe('response.create');

      console.log('✅ Response create event valid');
    });
  });

  test.describe('Stream State Management', () => {

    test('should track stream state correctly', () => {
      console.log('📊 Testing stream state tracking...');

      class StreamState {
        constructor() {
          this.streamSid = null;
          this.isActive = false;
          this.latestMediaTimestamp = 0;
          this.packetsReceived = 0;
          this.packetsSent = 0;
          this.startTime = null;
        }

        start(streamSid) {
          this.streamSid = streamSid;
          this.isActive = true;
          this.startTime = Date.now();
          this.latestMediaTimestamp = 0;
          this.packetsReceived = 0;
          this.packetsSent = 0;
        }

        receiveMedia(timestamp) {
          this.latestMediaTimestamp = parseInt(timestamp);
          this.packetsReceived++;
        }

        sendMedia() {
          this.packetsSent++;
        }

        stop() {
          this.isActive = false;
        }

        getStats() {
          return {
            streamSid: this.streamSid,
            isActive: this.isActive,
            duration: this.startTime ? Date.now() - this.startTime : 0,
            packetsReceived: this.packetsReceived,
            packetsSent: this.packetsSent,
            latestTimestamp: this.latestMediaTimestamp
          };
        }
      }

      const state = new StreamState();
      expect(state.isActive).toBe(false);

      state.start('MZ123456');
      expect(state.isActive).toBe(true);
      expect(state.streamSid).toBe('MZ123456');

      state.receiveMedia('100');
      state.receiveMedia('120');
      state.receiveMedia('140');
      expect(state.packetsReceived).toBe(3);
      expect(state.latestMediaTimestamp).toBe(140);

      state.sendMedia();
      state.sendMedia();
      expect(state.packetsSent).toBe(2);

      const stats = state.getStats();
      expect(stats.packetsReceived).toBe(3);
      expect(stats.packetsSent).toBe(2);

      state.stop();
      expect(state.isActive).toBe(false);

      console.log('✅ Stream state tracking works correctly');
    });

    test('should manage mark queue correctly', () => {
      console.log('🏷️  Testing mark queue management...');

      class MarkQueue {
        constructor() {
          this.queue = [];
        }

        add(markName) {
          this.queue.push({
            name: markName,
            timestamp: Date.now()
          });
        }

        remove() {
          return this.queue.shift();
        }

        clear() {
          this.queue = [];
        }

        size() {
          return this.queue.length;
        }

        isEmpty() {
          return this.queue.length === 0;
        }
      }

      const queue = new MarkQueue();
      expect(queue.isEmpty()).toBe(true);

      queue.add('mark1');
      queue.add('mark2');
      queue.add('mark3');
      expect(queue.size()).toBe(3);

      const mark = queue.remove();
      expect(mark.name).toBe('mark1');
      expect(queue.size()).toBe(2);

      queue.clear();
      expect(queue.isEmpty()).toBe(true);

      console.log('✅ Mark queue management works correctly');
    });
  });

  test.describe('Error Detection and Validation', () => {

    test('should detect invalid audio payload format', () => {
      console.log('❌ Testing invalid payload detection...');

      const validateAudioPayload = (payload) => {
        if (!payload) return false;
        if (typeof payload !== 'string') return false;

        // Check if valid base64
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        if (!base64Regex.test(payload)) return false;

        try {
          Buffer.from(payload, 'base64');
          return true;
        } catch (e) {
          return false;
        }
      };

      expect(validateAudioPayload('SGVsbG8=')).toBe(true);
      expect(validateAudioPayload(Buffer.alloc(160).toString('base64'))).toBe(true);

      expect(validateAudioPayload(null)).toBe(false);
      expect(validateAudioPayload(undefined)).toBe(false);
      expect(validateAudioPayload('')).toBe(false); // Empty payload is invalid (no audio data)
      expect(validateAudioPayload('not base64!@#')).toBe(false);
      expect(validateAudioPayload(12345)).toBe(false);

      console.log('✅ Payload validation works correctly');
    });

    test('should detect missing required event fields', () => {
      console.log('❌ Testing required field validation...');

      const validateMediaEvent = (event) => {
        if (!event) return { valid: false, error: 'Event is null or undefined' };
        if (event.event !== 'media') return { valid: false, error: 'Not a media event' };
        if (!event.media) return { valid: false, error: 'Missing media field' };
        if (!event.media.payload) return { valid: false, error: 'Missing payload' };
        if (!event.streamSid) return { valid: false, error: 'Missing streamSid' };

        return { valid: true };
      };

      const validEvent = {
        event: 'media',
        media: { payload: 'SGVsbG8=' },
        streamSid: 'MZ123'
      };

      const result1 = validateMediaEvent(validEvent);
      expect(result1.valid).toBe(true);

      const invalidEvent1 = { event: 'media', media: {} };
      const result2 = validateMediaEvent(invalidEvent1);
      expect(result2.valid).toBe(false);
      expect(result2.error).toBe('Missing payload');

      const invalidEvent2 = { event: 'start' };
      const result3 = validateMediaEvent(invalidEvent2);
      expect(result3.valid).toBe(false);

      console.log('✅ Field validation works correctly');
    });

    test('should detect timestamp anomalies', () => {
      console.log('⚠️  Testing timestamp anomaly detection...');

      const detectTimestampAnomaly = (previousTimestamp, currentTimestamp) => {
        const diff = currentTimestamp - previousTimestamp;

        // Normal is 20ms, allow 0-100ms
        if (diff < 0) return { anomaly: true, type: 'backwards', diff };
        if (diff > 100) return { anomaly: true, type: 'large_gap', diff };
        if (diff === 0) return { anomaly: true, type: 'duplicate', diff };

        return { anomaly: false, diff };
      };

      expect(detectTimestampAnomaly(100, 120).anomaly).toBe(false);
      expect(detectTimestampAnomaly(100, 100).anomaly).toBe(true);
      expect(detectTimestampAnomaly(100, 90).anomaly).toBe(true);
      expect(detectTimestampAnomaly(100, 300).anomaly).toBe(true);

      const result = detectTimestampAnomaly(100, 90);
      expect(result.type).toBe('backwards');

      console.log('✅ Anomaly detection works correctly');
    });
  });
});
