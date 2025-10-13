#!/usr/bin/env node

import fetch from 'node-fetch';

// Test configuration - webhook endpoint that will receive call outcome notifications
const WEBHOOK_BASE_URL = 'http://localhost:5051';
const WEBHOOK_URL = `${WEBHOOK_BASE_URL}/webhook`;

// Simple test server to receive webhook notifications
import express from 'express';
const app = express();
app.use(express.json());

const receivedNotifications = [];

// Agent webhook endpoint to receive call outcome notifications
app.post('/agent-callback', (req, res) => {
    const notification = req.body;
    console.log('\n🔔 RECEIVED AGENT NOTIFICATION:');
    console.log('Event:', notification.event);
    console.log('Status:', notification.status);
    console.log('Timestamp:', notification.timestamp);

    if (notification.data) {
        console.log('Webhook Call ID:', notification.data.webhookCallId);
        console.log('Patient:', notification.data.patient?.name || 'Unknown');
        console.log('Phone:', notification.data.patient?.phoneNumber || 'Unknown');

        if (notification.data.transcript) {
            console.log('Transcript available:', notification.data.transcript.conversation ? 'Yes' : 'No');
            console.log('Total exchanges:', notification.data.transcript.totalExchanges || 0);
        }

        if (notification.data.failureReason) {
            console.log('Failure reason:', notification.data.failureReason);
        }
    }

    receivedNotifications.push(notification);
    res.json({ success: true, received: true });
});

// Start test callback server
const TEST_PORT = 3001;
const callbackServer = app.listen(TEST_PORT, () => {
    console.log(`🔗 Test callback server listening on port ${TEST_PORT}`);
    console.log(`📡 Agent callback URL: http://localhost:${TEST_PORT}/agent-callback`);
});

// Test scenarios
const testScenarios = [
    {
        name: 'Normal Call with Callback URL',
        data: {
            phoneNumber: '+15551234567',
            patientName: 'John Test Patient',
            patientId: 'TEST001',
            message: 'Test call with post-call webhook notification',
            callbackUrl: `http://localhost:${TEST_PORT}/agent-callback`
        }
    },
    {
        name: 'High Priority Call with Callback',
        data: {
            phoneNumber: '+15559876543',
            patientName: 'Jane Urgent Patient',
            patientId: 'TEST002',
            message: 'Urgent test call with callback notification',
            priority: 'high',
            callbackUrl: `http://localhost:${TEST_PORT}/agent-callback`
        }
    }
];

// Test execution
async function runTest() {
    console.log('🧪 POST-CALL WEBHOOK NOTIFICATION TEST');
    console.log('='.repeat(50));

    for (const scenario of testScenarios) {
        console.log(`\n📞 Testing: ${scenario.name}`);
        console.log('Data:', JSON.stringify(scenario.data, null, 2));

        try {
            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(scenario.data)
            });

            const result = await response.json();

            if (response.ok) {
                console.log('✅ Webhook request sent successfully');
                console.log('Webhook Call ID:', result.webhookCallId);
                console.log('Status:', result.status);
                console.log('Check Status URL:', result.checkStatusUrl);
            } else {
                console.log('❌ Webhook request failed:', result);
            }
        } catch (error) {
            console.log('❌ Error sending webhook:', error.message);
        }

        // Wait a bit between tests
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n⏳ Waiting 30 seconds for call outcomes...');
    console.log('💡 Note: Calls will likely fail since these are test numbers');
    console.log('💡 But we should receive failure notifications from the system');

    // Wait for notifications
    setTimeout(() => {
        console.log('\n📊 NOTIFICATION SUMMARY:');
        console.log(`Total notifications received: ${receivedNotifications.length}`);

        receivedNotifications.forEach((notification, index) => {
            console.log(`\n${index + 1}. ${notification.event} - ${notification.status}`);
            console.log(`   Patient: ${notification.data?.patient?.name || 'Unknown'}`);
            console.log(`   Reason: ${notification.data?.failureReason || 'N/A'}`);
        });

        if (receivedNotifications.length > 0) {
            console.log('\n✅ POST-CALL WEBHOOK SYSTEM IS WORKING!');
        } else {
            console.log('\n⚠️  No notifications received. Check system logs.');
        }

        console.log('\n🔚 Test completed. Shutting down...');
        callbackServer.close();
        process.exit(0);
    }, 30000);
}

// Error handling
process.on('unhandledRejection', (error) => {
    console.error('Unhandled error:', error.message);
    callbackServer.close();
    process.exit(1);
});

process.on('SIGINT', () => {
    console.log('\n🛑 Test interrupted. Shutting down...');
    callbackServer.close();
    process.exit(0);
});

// Start test
runTest().catch(error => {
    console.error('Test execution failed:', error.message);
    callbackServer.close();
    process.exit(1);
});