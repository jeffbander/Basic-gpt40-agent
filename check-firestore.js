import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env.production') });

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkFirestore() {
    try {
        console.log('Checking Firestore...\n');

        const snapshot = await db.collection('patients').get();
        console.log(`Total patients in Firestore: ${snapshot.size}`);

        if (snapshot.size > 0) {
            console.log('\nPatients:');
            snapshot.forEach(doc => {
                const data = doc.data();
                console.log(`  - ID: ${doc.id}, Name: ${data.name}, MRN: ${data.mrn}`);
            });
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

checkFirestore();
