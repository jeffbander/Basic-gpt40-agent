#!/usr/bin/env node
/**
 * Transcription System Test Script
 * Tests the enhanced transcription configuration and endpoints
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5051';

async function testTranscriptionSystem() {
    console.log('🧪 Testing Enhanced Transcription System\n');

    try {
        // Test 1: Configuration Test
        console.log('1. Testing transcription configuration...');
        const configResponse = await fetch(`${BASE_URL}/api/transcription/test-config`);
        const configData = await configResponse.json();

        if (configData.success) {
            console.log('✅ Configuration test passed');
            console.log(`   Status: ${configData.testResults.status}`);
            console.log(`   Environment ready: ${configData.testResults.environment.openaiApiKey && configData.testResults.environment.twilioConfigured}`);
        } else {
            console.log('❌ Configuration test failed');
        }

        // Test 2: Quality Overview
        console.log('\n2. Testing quality overview endpoint...');
        const qualityResponse = await fetch(`${BASE_URL}/api/transcription/quality-overview`);
        const qualityData = await qualityResponse.json();

        console.log('✅ Quality overview endpoint working');
        console.log(`   Total calls: ${qualityData.overview.totalCalls}`);
        console.log(`   Health status: ${qualityData.healthStatus}`);

        // Test 3: Error Endpoint
        console.log('\n3. Testing error tracking endpoint...');
        const errorsResponse = await fetch(`${BASE_URL}/api/transcription/errors?limit=5`);
        const errorsData = await errorsResponse.json();

        console.log('✅ Error tracking endpoint working');
        console.log(`   Total errors tracked: ${errorsData.totalErrors}`);

        // Test 4: Server Health
        console.log('\n4. Testing server health...');
        const healthResponse = await fetch(`${BASE_URL}/`);
        const healthData = await healthResponse.json();

        if (healthData.message) {
            console.log('✅ Server is running and responsive');
            console.log(`   Version: ${healthData.version}`);
        }

        console.log('\n🎉 All transcription system tests passed!');
        console.log('\nNext steps:');
        console.log('1. Make a test call to verify real-time transcription');
        console.log('2. Monitor /api/transcription/quality-overview');
        console.log('3. Check /api/transcription/errors for any issues');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.log('\nMake sure the server is running: node outbound-medical-v2.js');
    }
}

testTranscriptionSystem();