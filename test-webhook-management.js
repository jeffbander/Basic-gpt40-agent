#!/usr/bin/env node

import fetch from 'node-fetch';

// Test configuration
const BASE_URL = 'http://localhost:5051';
const WEBHOOK_URL = `${BASE_URL}/webhook`;
const HEALTH_URL = `${BASE_URL}/api/call-management/health`;

// Test data scenarios
const testScenarios = [
    {
        name: 'Normal Priority - Business Hours',
        data: {
            phoneNumber: '+1234567890',
            patientName: 'John Doe',
            patientId: 'PAT001',
            message: 'Routine wellness check'
        }
    },
    {
        name: 'High Priority - Follow-up',
        data: {
            phoneNumber: '+1555123456',
            patientName: 'Jane Smith',
            patientId: 'PAT002',
            message: 'Important follow-up appointment reminder',
            priority: 'high'
        }
    },
    {
        name: 'Emergency Priority',
        data: {
            phoneNumber: '+1555987654',
            patientName: 'Bob Johnson',
            patientId: 'PAT003',
            message: 'Emergency contact required immediately',
            priority: 'emergency',
            urgent: true
        }
    },
    {
        name: 'Duplicate Test - Same Patient',
        data: {
            phoneNumber: '+1234567890',
            patientName: 'John Doe',
            patientId: 'PAT001',
            message: 'Another wellness check (should be duplicate)'
        }
    },
    {
        name: 'Different Patient - Same Phone',
        data: {
            phoneNumber: '+1234567890',
            patientName: 'John Doe Jr',
            patientId: 'PAT004',
            message: 'Different patient, same phone'
        }
    }
];

// Utility functions
function formatTimestamp(date) {
    return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
}

function logTest(message, status = 'INFO') {
    const timestamp = formatTimestamp(new Date());
    const statusSymbol = {
        'INFO': 'ℹ️',
        'SUCCESS': '✅',
        'ERROR': '❌',
        'WARNING': '⚠️'
    }[status] || 'ℹ️';

    console.log(`[${timestamp}] ${statusSymbol} ${message}`);
}

async function makeRequest(url, method = 'GET', data = null) {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Call-Management-Test/1.0'
            }
        };

        if (data && method !== 'GET') {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);
        const responseData = await response.json();

        return {
            success: response.ok,
            status: response.status,
            data: responseData
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

async function testHealthCheck() {
    logTest('Testing health check endpoint...');

    const result = await makeRequest(HEALTH_URL);

    if (result.success) {
        logTest('Health check passed', 'SUCCESS');
        console.log('  Status:', result.data.status);
        console.log('  Capabilities:', Object.keys(result.data.capabilities).filter(k => result.data.capabilities[k]).join(', '));
        return true;
    } else {
        logTest(`Health check failed: ${result.error || result.status}`, 'ERROR');
        return false;
    }
}

async function testWebhookScenario(scenario, index) {
    logTest(`\nTesting Scenario ${index + 1}: ${scenario.name}`);
    console.log('  Data:', JSON.stringify(scenario.data, null, 2));

    const result = await makeRequest(WEBHOOK_URL, 'POST', scenario.data);

    if (result.success) {
        logTest(`Webhook processed successfully`, 'SUCCESS');
        console.log('  Response:', JSON.stringify(result.data, null, 2));

        // Extract webhook call ID for status check
        if (result.data.webhookCallId) {
            await testWebhookStatus(result.data.webhookCallId);
        }

        return result.data;
    } else {
        logTest(`Webhook failed: ${result.error || result.status}`, 'ERROR');
        if (result.data) {
            console.log('  Error details:', JSON.stringify(result.data, null, 2));
        }
        return null;
    }
}

async function testWebhookStatus(webhookCallId) {
    logTest(`  Checking status for webhook ${webhookCallId}...`);

    const statusUrl = `${BASE_URL}/api/webhook/status/${webhookCallId}`;
    const result = await makeRequest(statusUrl);

    if (result.success) {
        logTest(`  Status check successful`, 'SUCCESS');
        console.log('    Status:', result.data.status);
        console.log('    Priority:', result.data.priority);
        console.log('    Scheduled:', result.data.scheduledTime);
        if (result.data.estimatedWaitTime) {
            console.log('    Wait time:', result.data.estimatedWaitTime, 'minutes');
        }
    } else {
        logTest(`  Status check failed: ${result.error || result.status}`, 'WARNING');
    }
}

async function testQueueStats() {
    logTest('\nTesting queue statistics...');

    const statsUrl = `${BASE_URL}/api/call-management/queue/stats`;
    const result = await makeRequest(statsUrl);

    if (result.success) {
        logTest('Queue stats retrieved successfully', 'SUCCESS');
        console.log('  Summary:', JSON.stringify(result.data.summary, null, 2));

        if (result.data.details && result.data.details.length > 0) {
            console.log('  Details:');
            result.data.details.forEach(detail => {
                console.log(`    ${detail.status} (priority ${detail.priority}): ${detail.count} calls`);
            });
        }
    } else {
        logTest(`Queue stats failed: ${result.error || result.status}`, 'WARNING');
    }
}

async function testDuplicateDetection() {
    logTest('\nTesting duplicate detection with rapid requests...');

    const duplicateData = {
        phoneNumber: '+1999888777',
        patientName: 'Duplicate Test Patient',
        patientId: 'PAT999',
        message: 'Duplicate detection test'
    };

    // Send first request
    logTest('  Sending first request...');
    const first = await makeRequest(WEBHOOK_URL, 'POST', duplicateData);

    if (first.success) {
        logTest('  First request successful', 'SUCCESS');

        // Send duplicate request immediately
        logTest('  Sending duplicate request...');
        const duplicate = await makeRequest(WEBHOOK_URL, 'POST', duplicateData);

        if (duplicate.success) {
            logTest('  Duplicate was not detected (unexpected)', 'WARNING');
        } else {
            logTest('  Duplicate correctly detected and rejected', 'SUCCESS');
            console.log('    Error:', duplicate.data?.error?.message || 'Unknown error');
        }
    } else {
        logTest('  First request failed, cannot test duplicates', 'ERROR');
    }
}

async function summarizeResults(results) {
    logTest('\n' + '='.repeat(50));
    logTest('TEST SUMMARY');
    logTest('='.repeat(50));

    const successful = results.filter(r => r !== null).length;
    const total = results.length;

    logTest(`Scenarios tested: ${total}`);
    logTest(`Successful: ${successful}`);
    logTest(`Failed: ${total - successful}`);

    if (successful === total) {
        logTest('All tests passed! Call management system is working correctly.', 'SUCCESS');
    } else if (successful > 0) {
        logTest('Some tests passed. Check failed scenarios above.', 'WARNING');
    } else {
        logTest('All tests failed. Check system configuration.', 'ERROR');
    }
}

// Main test execution
async function runAllTests() {
    console.log('🏥 Medical Call Management System - Webhook Testing');
    console.log('='.repeat(60));

    // Health check first
    const healthOk = await testHealthCheck();
    if (!healthOk) {
        logTest('Health check failed, aborting tests', 'ERROR');
        return;
    }

    // Add delay to ensure system is ready
    logTest('Waiting 2 seconds for system to be ready...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test all scenarios
    const results = [];
    for (let i = 0; i < testScenarios.length; i++) {
        const result = await testWebhookScenario(testScenarios[i], i);
        results.push(result);

        // Add small delay between tests
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Test duplicate detection
    await testDuplicateDetection();

    // Test queue stats
    await testQueueStats();

    // Summarize results
    await summarizeResults(results);

    logTest('\nTest execution completed.');
}

// Error handling
process.on('unhandledRejection', (error) => {
    logTest(`Unhandled error: ${error.message}`, 'ERROR');
    process.exit(1);
});

// Run tests
runAllTests().catch(error => {
    logTest(`Test execution failed: ${error.message}`, 'ERROR');
    process.exit(1);
});