# Twilio Audio Pipeline Test Suite

Comprehensive test suite for the Twilio Media Stream + OpenAI Realtime API audio pipeline.

## Test Files

### 1. `twilio-audio-full.spec.js`
**Comprehensive integration tests for the complete Twilio audio pipeline**

Tests include:
- WebSocket connection establishment and lifecycle
- Twilio Media Stream event handling (start, media, mark, clear)
- Audio format validation (PCM-ulaw)
- Timestamp synchronization
- Error handling and recovery
- Interruption and speech detection
- Performance and load testing

**Run with:**
```bash
npm run test:audio-full
```

### 2. `audio-utils.test.js`
**Unit tests for audio utilities and helper functions**

Tests include:
- PCM-ulaw audio format handling
- Buffer creation and validation
- Base64 encoding/decoding
- Timestamp calculations
- Event builder functions (Twilio and OpenAI)
- Stream state management
- Mark queue management
- Error detection and validation

**Run with:**
```bash
npm run test:audio-utils
```

### 3. `e2e-call-flows.spec.js`
**End-to-end tests for complete call scenarios**

Tests include:
- Complete inbound call flow (webhook → WebSocket → audio → AI → response)
- Outbound call initiation and completion
- Multi-turn conversations
- Call interruption scenarios
- Rapid back-and-forth exchanges
- Long call quality maintenance
- Call termination and cleanup
- Medical context handling

**Run with:**
```bash
npm run test:e2e-calls
```

### 4. `edge-cases.spec.js`
**Edge case and error handling tests**

Tests include:
- Malformed JSON and invalid data
- Corrupted base64 audio payloads
- Connection failures and recovery
- Network timeouts
- Rapid connect/disconnect cycles
- Resource limits (memory, connections)
- Burst traffic handling
- Out-of-order timestamps
- State transition edge cases

**Run with:**
```bash
npm run test:edge-cases
```

### 5. `medical-call-test.spec.js`
**Existing medical calling system tests**

Tests the outbound medical calling system with transcript capture.

**Run with:**
```bash
npm run test:call
```

## Running Tests

### Run All Audio Tests
```bash
npm run test:audio-all
```

### Run Specific Test Suite
```bash
# Full integration tests
npm run test:audio-full

# Audio utilities
npm run test:audio-utils

# End-to-end call flows
npm run test:e2e-calls

# Edge cases
npm run test:edge-cases

# Medical call tests
npm run test:call
```

### Run Tests in Headed Mode (with browser visible)
```bash
npm run test:audio-full -- --headed
npm run test:e2e-calls -- --headed
```

### Run Specific Test
```bash
# Run a specific test file
npx playwright test tests/twilio-audio-full.spec.js

# Run tests matching a pattern
npx playwright test --grep "WebSocket connection"

# Run a specific test by line number
npx playwright test tests/twilio-audio-full.spec.js:42
```

## Prerequisites

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Servers

**Inbound Server (port 5050):**
```bash
npm run start:inbound
```

**Outbound Server (port 5051):**
```bash
npm run start:medical
```

### 3. Environment Variables
Ensure your `.env` file contains:
```env
OPENAI_API_KEY=your_openai_api_key
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
```

## Test Coverage

### Audio Pipeline Components Tested

#### ✅ WebSocket Connections
- Connection establishment
- Concurrent connections
- Graceful closure
- Reconnection after disconnection

#### ✅ Twilio Media Stream Events
- `start` event handling
- `media` event processing
- `mark` event synchronization
- `clear` event for interruption

#### ✅ Audio Processing
- PCM-ulaw format validation
- Buffer size calculations
- Base64 encoding/decoding
- Audio quality maintenance

#### ✅ Timestamp Management
- Sequential timestamps
- Gap detection
- Out-of-order handling
- Large value support

#### ✅ OpenAI Integration
- Session updates
- Audio buffer append
- Response creation
- Conversation truncation

#### ✅ Error Handling
- Invalid JSON
- Missing fields
- Corrupted payloads
- Connection failures
- API errors

#### ✅ Performance
- Sustained streaming
- Memory efficiency
- Burst traffic
- Long call duration

## Test Results

View test results:
```bash
# View HTML report
npx playwright show-report

# View JSON results
cat test-results.json
```

## Continuous Integration

These tests can be integrated into CI/CD pipelines:

```yaml
# GitHub Actions example
- name: Run Audio Tests
  run: |
    npm run start:inbound &
    npm run start:medical &
    sleep 5
    npm run test:audio-all
```

## Debugging Tests

### Enable Debug Logging
```bash
DEBUG=pw:api npm run test:audio-full
```

### Run with Trace
```bash
npx playwright test --trace on
npx playwright show-trace trace.zip
```

### Take Screenshots on Failure
Screenshots are automatically saved to `test-results/` on test failure.

## Test Development Guidelines

### Writing New Tests
1. Use descriptive test names
2. Add console logs for debugging
3. Handle async operations properly
4. Clean up resources (close WebSockets)
5. Use appropriate timeouts
6. Test both success and failure paths

### Test Structure
```javascript
test('should describe what the test does', async () => {
  console.log('📝 Testing specific feature...');

  // Arrange - set up test conditions
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve) => ws.on('open', resolve));

  // Act - perform the action
  ws.send(JSON.stringify({ event: 'test' }));
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Assert - verify the result
  expect(ws.readyState).toBe(WebSocket.OPEN);

  // Cleanup
  ws.close();

  console.log('✅ Test completed');
});
```

## Common Issues

### Server Not Running
**Error:** `Connection refused`
**Solution:** Start the appropriate server before running tests

### Timeouts
**Error:** `Test timeout of 30000ms exceeded`
**Solution:** Increase timeout with `test.setTimeout(60000)`

### Port Already in Use
**Error:** `EADDRINUSE: address already in use`
**Solution:** Kill existing processes or change port in `.env`

### WebSocket Connection Failed
**Error:** `WebSocket connection failed`
**Solution:** Check server logs and firewall settings

## Performance Benchmarks

Expected performance metrics:
- Connection establishment: < 1 second
- Audio processing latency: < 500ms
- Memory usage: < 200MB for 5-minute call
- Concurrent connections: 10+ supported

## Contributing

When adding new tests:
1. Follow the existing test structure
2. Add documentation to this README
3. Ensure tests pass locally
4. Add appropriate error handling
5. Include descriptive console logs

## Resources

- [Twilio Media Streams Documentation](https://www.twilio.com/docs/voice/twiml/stream)
- [OpenAI Realtime API Documentation](https://platform.openai.com/docs/api-reference/realtime)
- [Playwright Documentation](https://playwright.dev)
- [WebSocket API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

## License

ISC
