#!/usr/bin/env node

import fetch from 'node-fetch';

// Test webhook endpoint
const webhookUrl = 'http://localhost:5051/api/webhook/agent-trigger';

// Test case 1: Standard format (existing)
const testCase1 = {
    name: "Standard Agent Format",
    data: {
        call_objectives: [
            "Verify current medications",
            "Check blood pressure readings",
            "Ask about any chest pain or shortness of breath"
        ],
        Master_note: "Patient has history of hypertension and type 2 diabetes. Recently started on new blood pressure medication (Lisinopril 10mg).",
        PPD_demo: `Patient Name: Zacko, Cynthia
MRN: TEST-2025-001
Date of Birth: 03/15/1955
Phone: 555-123-4567
Gender: Female
Conditions: Hypertension, Type 2 Diabetes`
    }
};

// Test case 2: Nested JSON structure
const testCase2 = {
    name: "Nested JSON Format",
    data: {
        patient: {
            name: "John Smith",
            phone: "+1-555-987-6543",
            dob: "1980-05-15",
            mrn: "NESTED-001"
        },
        clinical: {
            notes: "Routine follow-up for diabetes management. Patient reports good adherence to medication.",
            objectives: ["Review glucose logs", "Adjust insulin dosage if needed"]
        }
    }
};

// Test case 3: Alternative field names
const testCase3 = {
    name: "Alternative Field Names",
    data: {
        patient_name: "Maria Rodriguez",
        phoneNumber: "555.444.3333",
        medical_record_number: "ALT-789",
        date_of_birth: "12/25/1990",
        gender: "female",
        clinical_notes: "Post-surgery follow-up. Patient recovering well from appendectomy.",
        call_goals: [
            "Check incision healing",
            "Assess pain levels",
            "Review activity restrictions"
        ]
    }
};

// Test case 4: Mixed format with arrays
const testCase4 = {
    name: "Mixed Format with Arrays",
    data: {
        patients: [{
            full_name: "Robert Johnson",
            contact_number: "(555) 111-2222",
            chart_number: "MIX-456"
        }],
        agenda: "Cardiovascular risk assessment and lifestyle counseling",
        objectives: "Check cholesterol levels; Discuss exercise plan; Review diet"
    }
};

// Test case 5: Minimal required data
const testCase5 = {
    name: "Minimal Required Data",
    data: {
        phone: "+15551234567",
        name: "Jane Doe"
    }
};

// Test case 6: Complex nested with contact info
const testCase6 = {
    name: "Complex Nested Structure",
    data: {
        patientInfo: {
            demographics: {
                firstName: "Michael",
                lastName: "Brown",
                birthDate: "1975-08-30"
            },
            contact: {
                phone: "555-777-8888",
                mobile: "555-888-9999"
            },
            medical: {
                id: "COMPLEX-999",
                history: "Chronic kidney disease stage 3. On ACE inhibitor therapy."
            }
        },
        callPurpose: {
            primary: "Monitor kidney function",
            secondary: ["Review medications", "Dietary counseling"]
        }
    }
};

// Test case 7: Invalid data (missing phone)
const testCase7 = {
    name: "Invalid Data - Missing Phone",
    data: {
        patient_name: "Invalid Patient",
        mrn: "NO-PHONE-001",
        notes: "This should fail because no phone number is provided"
    }
};

const testCases = [
    testCase1, testCase2, testCase3, testCase4,
    testCase5, testCase6, testCase7
];

async function runTest(testCase) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 Testing: ${testCase.name}`);
    console.log(`${'='.repeat(60)}`);
    console.log('Payload:', JSON.stringify(testCase.data, null, 2));

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testCase.data)
        });

        const result = await response.json();

        if (response.ok) {
            console.log('✅ SUCCESS!');
            console.log('Response:', JSON.stringify(result, null, 2));

            // Show parsing report if available
            if (result.parsingReport) {
                console.log('\n📊 Parsing Report:');
                console.log(`  Success: ${result.parsingReport.success}`);
                console.log(`  Fields Found: ${Object.keys(result.parsingReport.fieldsFound).join(', ')}`);
                if (result.parsingReport.warnings.length > 0) {
                    console.log(`  Warnings: ${result.parsingReport.warnings.join(', ')}`);
                }
            }

            if (result.webhookCallId) {
                console.log(`\n🔗 Status URL: http://localhost:5051${result.checkStatusUrl}`);
            }
        } else {
            console.log('❌ FAILED!');
            console.log('Error:', JSON.stringify(result, null, 2));

            // Show parsing details for failed cases
            if (result.parsingReport) {
                console.log('\n📊 Parsing Report:');
                console.log(`  Success: ${result.parsingReport.success}`);
                console.log(`  Fields Missing: ${result.parsingReport.fieldsMissing.join(', ')}`);
                console.log(`  Warnings: ${result.parsingReport.warnings.join(', ')}`);
            }
        }

        return { success: response.ok, testCase: testCase.name, response: result };

    } catch (error) {
        console.log('❌ REQUEST FAILED!');
        console.log('Error:', error.message);
        return { success: false, testCase: testCase.name, error: error.message };
    }
}

async function runAllTests() {
    console.log('🚀 Enhanced Webhook Parser Test Suite');
    console.log('=====================================\n');
    console.log('Testing various agent data formats...\n');

    const results = [];

    for (const testCase of testCases) {
        const result = await runTest(testCase);
        results.push(result);

        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Summary
    console.log(`\n\n${'='.repeat(60)}`);
    console.log('📋 TEST SUMMARY');
    console.log(`${'='.repeat(60)}`);

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Total Tests: ${results.length}`);
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);

    console.log('\nDetailed Results:');
    results.forEach((result, i) => {
        const status = result.success ? '✅' : '❌';
        console.log(`  ${i + 1}. ${status} ${result.testCase}`);
    });

    console.log('\n💡 Tips:');
    console.log('  - Failed tests show parsing reports with missing fields');
    console.log('  - Successful tests return webhookCallId for status tracking');
    console.log('  - Check server logs for detailed parsing information');

    console.log('\nTo check call status for successful tests:');
    console.log('  curl http://localhost:5051/api/webhook/status/{webhookCallId}');
}

// Check if server is running
async function checkServer() {
    try {
        const response = await fetch('http://localhost:5051/api/transcription/test-config');
        if (response.ok) {
            console.log('✅ Server is running');
            return true;
        }
    } catch (error) {
        console.log('❌ Server not running on port 5051');
        console.log('Please run: npm run start:medical');
        return false;
    }
}

// Main execution
(async () => {
    if (await checkServer()) {
        await runAllTests();
    }
})();