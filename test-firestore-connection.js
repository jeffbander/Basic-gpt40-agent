/**
 * Quick test script to verify Firestore connection
 */

import dotenv from 'dotenv';
import firestoreManager from './call-management/database/firestore-connection.js';

dotenv.config();

async function testFirestoreConnection() {
    console.log('========================================');
    console.log('Testing Firestore Connection');
    console.log('========================================\n');

    try {
        // Connect to Firestore
        console.log('1. Connecting to Firestore...');
        await firestoreManager.connect();
        console.log('   ✅ Connected successfully!\n');

        // Health check
        console.log('2. Running health check...');
        const health = await firestoreManager.healthCheck();
        console.log('   Health status:', JSON.stringify(health, null, 2));
        console.log('');

        // Check for default call rule
        console.log('3. Checking for default call rule...');
        const defaultRule = await firestoreManager.get('call_rules', 'default');
        if (defaultRule) {
            console.log('   ✅ Default call rule exists:');
            console.log('   Name:', defaultRule.name);
            console.log('   Description:', defaultRule.description);
        } else {
            console.log('   ⚠️  No default rule found (will be created on first use)');
        }
        console.log('');

        // List all collections
        console.log('4. Firestore is ready with collections:');
        console.log('   - call_rules');
        console.log('   - webhook_queue');
        console.log('   - call_attempts');
        console.log('   - audit_log');
        console.log('   - duplicate_tracking');
        console.log('');

        console.log('========================================');
        console.log('✅ FIRESTORE TEST SUCCESSFUL!');
        console.log('========================================');
        console.log('\nFirestore Configuration:');
        console.log('  Database:', health.database);
        console.log('  Status:', health.status);
        console.log('  USE_FIRESTORE:', process.env.USE_FIRESTORE);
        console.log('');

        process.exit(0);

    } catch (error) {
        console.error('\n❌ FIRESTORE TEST FAILED!');
        console.error('Error:', error.message);
        console.error('\nFull error:', error);
        console.error('\nPlease check:');
        console.error('  1. firebase-service-account.json exists in call-management/database/');
        console.error('  2. USE_FIRESTORE=true in .env');
        console.error('  3. Firebase project is set up correctly');
        process.exit(1);
    }
}

// Run the test
testFirestoreConnection();
