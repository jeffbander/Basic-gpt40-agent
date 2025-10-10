import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { promises as fs } from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load production environment variables
dotenv.config({ path: path.join(__dirname, '.env.production') });

// Initialize Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

async function migratePatients() {
    try {
        console.log('Reading local patient data...');
        const data = await fs.readFile('patients-v2.json', 'utf8');
        const patientsData = JSON.parse(data);

        console.log(`Found ${patientsData.patients.length} patients to migrate`);

        const batch = db.batch();

        for (const patient of patientsData.patients) {
            const patientRef = db.collection('patients').doc(patient.id);
            batch.set(patientRef, patient);
            console.log(`  - Queued: ${patient.name} (MRN: ${patient.mrn})`);
        }

        console.log('\nCommitting to Firestore...');
        await batch.commit();

        console.log('\n✅ Migration complete!');
        console.log(`Successfully migrated ${patientsData.patients.length} patients to Firestore`);

        // Verify
        const snapshot = await db.collection('patients').get();
        console.log(`\nVerification: ${snapshot.size} patients now in Firestore`);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migratePatients();
