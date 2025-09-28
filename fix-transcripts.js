import { promises as fs } from 'fs';
import crypto from 'crypto';

async function fixTranscripts() {
    console.log('Fixing transcripts and call history...\n');

    // Load patients data
    const patientsData = await fs.readFile('patients-v2.json', 'utf8');
    const patientsFile = JSON.parse(patientsData);

    // Load transcripts data
    const transcriptsData = await fs.readFile('call-transcripts.json', 'utf8');
    const transcripts = JSON.parse(transcriptsData);

    // Create new transcripts object with proper keys
    const newTranscripts = {};

    // Fix each patient's call history
    for (const patient of patientsFile.patients) {
        console.log(`Processing patient: ${patient.name} (${patient.mrn})`);

        // Fix callHistory entries without proper callIds
        for (let i = 0; i < patient.callHistory.length; i++) {
            const call = patient.callHistory[i];

            if (!call.callId || call.callId === 'null' || call.callId === 'undefined') {
                // Generate new unique callId
                const newCallId = crypto.randomUUID();
                call.callId = newCallId;
                console.log(`  - Fixed call ${i + 1}: assigned new ID ${newCallId}`);
            }
        }
    }

    // Handle transcripts with bad keys
    if (transcripts['null']) {
        console.log('\nFound transcript with "null" key');
        // Check if this is the Pincus Kaller transcript based on content
        const transcript = transcripts['null'];
        if (transcript.patientName === 'kaller, pincus' || transcript.mrn === 'J474995') {
            // This transcript doesn't match any existing patient in patients-v2.json
            // We'll save it separately with a proper key
            const newId = crypto.randomUUID();
            newTranscripts[newId] = transcript;
            console.log(`  - Saved Pincus Kaller transcript with new ID: ${newId}`);
        }
    }

    if (transcripts['undefined']) {
        console.log('\nFound transcript with "undefined" key');
        // This appears to be for John Smith based on the data
        const transcript = transcripts['undefined'];
        if (transcript.patientId === '550e8400-e29b-41d4-a716-446655440001') {
            // Find the corresponding call in John Smith's history
            const johnSmith = patientsFile.patients.find(p => p.id === '550e8400-e29b-41d4-a716-446655440001');
            if (johnSmith) {
                // Find a call that matches this transcript's timestamp
                const matchingCall = johnSmith.callHistory.find(call =>
                    call.timestamp === '2025-09-26T02:00:17.890Z'
                );
                if (matchingCall && matchingCall.callId) {
                    newTranscripts[matchingCall.callId] = transcript;
                    console.log(`  - Linked to John Smith's call: ${matchingCall.callId}`);
                }
            }
        }
    }

    // Copy over any properly keyed transcripts
    for (const [key, value] of Object.entries(transcripts)) {
        if (key !== 'null' && key !== 'undefined' && key.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            newTranscripts[key] = value;
        }
    }

    // Save updated files
    await fs.writeFile('patients-v2.json', JSON.stringify(patientsFile, null, 2));
    await fs.writeFile('call-transcripts.json', JSON.stringify(newTranscripts, null, 2));

    console.log('\n✅ Fixed call history and transcripts!');
    console.log(`   - Updated ${patientsFile.patients.length} patients`);
    console.log(`   - Fixed transcript keys: ${Object.keys(newTranscripts).length} transcripts now have proper IDs`);
}

fixTranscripts().catch(console.error);