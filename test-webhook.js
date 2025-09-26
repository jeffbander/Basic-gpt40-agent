#!/usr/bin/env node

import fetch from 'node-fetch';

// Test webhook endpoint
const webhookUrl = 'http://localhost:5051/api/webhook/agent-trigger';

const testData = {
    call_objectives: [
        "Verify current medications",
        "Check blood pressure readings",
        "Ask about any chest pain or shortness of breath",
        "Schedule follow-up appointment if needed"
    ],
    Master_note: "Patient has history of hypertension and type 2 diabetes. Recently started on new blood pressure medication (Lisinopril 10mg). Need to monitor for side effects and ensure medication compliance. Last A1C was 7.2.",
    PPD_demo: `Patient Name: Zacko, Cynthia
MRN: TEST-2025-001
Date of Birth: 03/15/1955
Phone: 555-123-4567
Gender: Female
Conditions: Hypertension, Type 2 Diabetes, Hyperlipidemia
Current Medications: Lisinopril 10mg daily, Metformin 1000mg twice daily, Atorvastatin 20mg daily`
};

async function testWebhook() {
    console.log('Testing webhook endpoint...\n');
    console.log('Sending test data to:', webhookUrl);
    console.log('Test patient:', 'Cynthia Zacko');
    console.log('Phone number:', '555-123-4567');
    console.log('\n-------------------\n');

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testData)
        });

        const result = await response.json();

        if (response.ok) {
            console.log('✅ Webhook accepted successfully!\n');
            console.log('Response:', JSON.stringify(result, null, 2));

            if (result.webhookCallId) {
                console.log('\n-------------------\n');
                console.log('To check call status, use:');
                console.log(`curl http://localhost:5051${result.checkStatusUrl}`);

                // Wait a few seconds then check status
                console.log('\nChecking status in 5 seconds...');
                setTimeout(async () => {
                    try {
                        const statusResponse = await fetch(`http://localhost:5051${result.checkStatusUrl}`);
                        const statusResult = await statusResponse.json();
                        console.log('\nStatus check result:', JSON.stringify(statusResult, null, 2));
                    } catch (error) {
                        console.error('Error checking status:', error.message);
                    }
                }, 5000);
            }
        } else {
            console.error('❌ Webhook failed:', response.status);
            console.error('Error:', result);
        }
    } catch (error) {
        console.error('❌ Request failed:', error.message);
        console.error('\nMake sure the server is running on port 5051');
        console.error('Run: npm run start:medical');
    }
}

// Run the test
console.log('===================');
console.log('Webhook Test Script');
console.log('===================\n');

testWebhook();