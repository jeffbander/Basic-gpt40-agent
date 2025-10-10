import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class FirestoreManager {
    constructor() {
        this.db = null;
        this.initialized = false;
    }

    async connect() {
        try {
            // Initialize Firebase Admin if not already initialized
            if (!admin.apps.length) {
                // Check for service account file or environment variable
                const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
                    || join(__dirname, 'firebase-service-account.json');

                let credential;

                if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
                    // Use JSON from environment variable (for Vercel deployment)
                    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
                    credential = admin.credential.cert(serviceAccount);
                } else {
                    // Use file path (for local development)
                    try {
                        const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
                        credential = admin.credential.cert(serviceAccount);
                    } catch (error) {
                        console.error('Error reading service account file:', error.message);
                        throw new Error('Firebase service account configuration not found. Please set FIREBASE_SERVICE_ACCOUNT_JSON or provide firebase-service-account.json');
                    }
                }

                admin.initializeApp({
                    credential: credential,
                    databaseURL: process.env.FIREBASE_DATABASE_URL
                });

                console.log('Firebase Admin initialized successfully');
            }

            this.db = admin.firestore();

            // Configure Firestore settings
            this.db.settings({
                ignoreUndefinedProperties: true,
            });

            await this.initializeSchema();
            this.initialized = true;
            console.log('Connected to Firestore database');

        } catch (error) {
            console.error('Error connecting to Firestore:', error);
            throw error;
        }
    }

    async initializeSchema() {
        try {
            // Check if default call rule exists
            const defaultRuleRef = this.db.collection('call_rules').doc('default');
            const defaultRule = await defaultRuleRef.get();

            if (!defaultRule.exists) {
                // Create default call rule
                await defaultRuleRef.set({
                    name: 'Default Business Hours',
                    description: 'Standard business hours calling rule',
                    calling_hours_start: '09:00',
                    calling_hours_end: '17:00',
                    timezone: 'America/New_York',
                    max_retry_attempts: 3,
                    retry_interval_minutes: 30,
                    retry_interval_no_answer: 30,
                    retry_interval_busy: 15,
                    retry_interval_failed: 60,
                    duplicate_window_minutes: 60,
                    is_active: true,
                    emergency_override_enabled: true,
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    updated_at: admin.firestore.FieldValue.serverTimestamp()
                });

                console.log('Default call rule created');
            }

            // Create indexes note - these will be created automatically by Firestore,
            // but you should add them in Firebase Console for production
            console.log('Database schema initialized');
            console.log('NOTE: Remember to create Firestore indexes in Firebase Console:');
            console.log('  - webhook_queue: status, scheduled_time, phone_number, duplicate_hash');
            console.log('  - call_attempts: webhook_queue_id, twilio_call_sid');
            console.log('  - audit_log: event_type, created_at');
            console.log('  - duplicate_tracking: duplicate_hash, expires_at');

        } catch (error) {
            console.error('Error initializing schema:', error);
            throw error;
        }
    }

    // Collection references
    getCollection(collectionName) {
        if (!this.initialized) {
            throw new Error('Firestore not initialized. Call connect() first.');
        }
        return this.db.collection(collectionName);
    }

    // CRUD operations with SQLite-compatible interface
    async run(collection, operation, data = {}) {
        const collectionRef = this.getCollection(collection);

        try {
            if (operation === 'insert') {
                const docRef = await collectionRef.add({
                    ...data,
                    created_at: admin.firestore.FieldValue.serverTimestamp()
                });
                return { id: docRef.id, ...data };
            } else if (operation === 'update') {
                const { id, ...updateData } = data;
                await collectionRef.doc(id).update({
                    ...updateData,
                    updated_at: admin.firestore.FieldValue.serverTimestamp()
                });
                return { id, ...updateData };
            } else if (operation === 'delete') {
                await collectionRef.doc(data.id).delete();
                return { id: data.id };
            }
        } catch (error) {
            console.error(`Error performing ${operation} on ${collection}:`, error);
            throw error;
        }
    }

    async get(collection, id) {
        const docRef = this.getCollection(collection).doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return null;
        }

        return { id: doc.id, ...doc.data() };
    }

    async all(collection, filters = {}, orderBy = null, limit = null) {
        let query = this.getCollection(collection);

        // Apply filters
        Object.entries(filters).forEach(([field, value]) => {
            if (typeof value === 'object' && value.operator) {
                query = query.where(field, value.operator, value.value);
            } else {
                query = query.where(field, '==', value);
            }
        });

        // Apply ordering
        if (orderBy) {
            query = query.orderBy(orderBy.field, orderBy.direction || 'asc');
        }

        // Apply limit
        if (limit) {
            query = query.limit(limit);
        }

        const snapshot = await query.get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async close() {
        // Firestore connections are managed by Firebase Admin SDK
        // No explicit close needed, but we can mark as not initialized
        this.initialized = false;
        console.log('Firestore connection marked as closed');
    }

    // Transaction support for HIPAA audit compliance
    async beginTransaction() {
        // Firestore uses a different transaction model
        // Return a transaction object that can be used
        return this.db.runTransaction.bind(this.db);
    }

    async withTransaction(callback) {
        return await this.db.runTransaction(async (transaction) => {
            return await callback(transaction);
        });
    }

    // Health check for monitoring
    async healthCheck() {
        try {
            // Try to read from a collection
            const testRef = this.db.collection('_health_check').doc('test');
            await testRef.set({ timestamp: admin.firestore.FieldValue.serverTimestamp() });
            await testRef.delete();

            return {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                database: 'firestore'
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString(),
                database: 'firestore'
            };
        }
    }

    // Batch operations for efficiency
    batch() {
        return this.db.batch();
    }

    // Helper for server timestamp
    serverTimestamp() {
        return admin.firestore.FieldValue.serverTimestamp();
    }

    // Helper for increment
    increment(value = 1) {
        return admin.firestore.FieldValue.increment(value);
    }

    // Helper for array operations
    arrayUnion(...elements) {
        return admin.firestore.FieldValue.arrayUnion(...elements);
    }

    arrayRemove(...elements) {
        return admin.firestore.FieldValue.arrayRemove(...elements);
    }
}

// Singleton instance
const firestoreManager = new FirestoreManager();

export default firestoreManager;
