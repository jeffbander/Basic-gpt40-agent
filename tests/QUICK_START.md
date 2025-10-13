# Quick Start Guide - Twilio Audio Tests

## 1. Start the Servers

Open **two** terminal windows:

**Terminal 1 - Inbound Server:**
```bash
npm run start:inbound
```

**Terminal 2 - Outbound Server:**
```bash
npm run start:medical
```

## 2. Run the Tests

Open a **third** terminal window and choose one:

### Option A: Interactive Test Runner (Windows)
```bash
.\run-audio-tests.bat
```

### Option B: Individual Test Suites

**Full Integration Tests:**
```bash
npm run test:audio-full
```

**Audio Utils Tests:**
```bash
npm run test:audio-utils
```

**End-to-End Call Tests:**
```bash
npm run test:e2e-calls
```

**Edge Case Tests:**
```bash
npm run test:edge-cases
```

**All Audio Tests:**
```bash
npm run test:audio-all
```

## 3. View Results

After tests complete, view the HTML report:
```bash
npx playwright show-report
```

## What Each Test Suite Does

### `test:audio-full` - Full Integration Tests
Tests the complete audio pipeline including:
- WebSocket connections
- Twilio Media Stream events
- Audio format handling
- Timestamp synchronization
- Interruption detection
- Performance metrics

**Duration:** ~5-10 minutes

### `test:audio-utils` - Audio Utils
Unit tests for audio utilities:
- Buffer handling
- Base64 encoding
- Event builders
- State management

**Duration:** ~1-2 minutes

### `test:e2e-calls` - End-to-End Calls
Complete call flow scenarios:
- Inbound calls
- Outbound calls
- Multi-turn conversations
- Call termination

**Duration:** ~10-15 minutes

### `test:edge-cases` - Edge Cases
Error handling and unusual scenarios:
- Malformed data
- Connection failures
- Resource limits
- Timing issues

**Duration:** ~5-10 minutes

## Troubleshooting

### Tests Failing?

**Check servers are running:**
```bash
# Should see "Server is listening on port 5050"
# and "Server is listening on port 5051"
```

**Check environment variables:**
```bash
# .env should contain:
OPENAI_API_KEY=sk-...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
```

**Try a simple test first:**
```bash
npm run test:audio-utils
```

### Connection Refused Error?
Start the servers (see step 1 above)

### Timeout Errors?
Some tests take time - this is normal. The tests will retry automatically.

## Tips

- Run `test:audio-utils` first (fastest, no server dependencies for most tests)
- Leave servers running between test runs
- Check the console output for detailed logs
- Use `--headed` flag to see browser tests: `npm run test:e2e-calls -- --headed`

## Next Steps

Once you're familiar with the tests:
1. Read the full `tests/README.md` for detailed documentation
2. Explore the test files in `tests/` directory
3. Add your own custom tests
4. Integrate into CI/CD pipeline

## Need Help?

Check the logs:
- Server logs show incoming connections and audio events
- Test logs show detailed step-by-step execution
- HTML report shows screenshots of failures

For more details, see `tests/README.md`
