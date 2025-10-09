import sqlite3 from 'sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class DatabaseManager {
    constructor() {
        this.db = null;
        this.dbPath = join(__dirname, 'call_management.db');
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Error opening database:', err);
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    this.initializeSchema()
                        .then(() => resolve())
                        .catch(reject);
                }
            });
        });
    }

    async initializeSchema() {
        const schemaPath = join(__dirname, 'schema.sql');
        const schema = readFileSync(schemaPath, 'utf8');

        return new Promise((resolve, reject) => {
            this.db.exec(schema, (err) => {
                if (err) {
                    console.error('Error initializing schema:', err);
                    reject(err);
                } else {
                    console.log('Database schema initialized');
                    resolve();
                }
            });
        });
    }

    async run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }

    async get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        console.log('Database connection closed');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    // Transaction support for HIPAA audit compliance
    async beginTransaction() {
        return this.run('BEGIN TRANSACTION');
    }

    async commit() {
        return this.run('COMMIT');
    }

    async rollback() {
        return this.run('ROLLBACK');
    }

    async withTransaction(callback) {
        await this.beginTransaction();
        try {
            const result = await callback();
            await this.commit();
            return result;
        } catch (error) {
            await this.rollback();
            throw error;
        }
    }

    // Health check for monitoring
    async healthCheck() {
        try {
            await this.get('SELECT 1 as test');
            return { status: 'healthy', timestamp: new Date().toISOString() };
        } catch (error) {
            return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
        }
    }
}

// Singleton instance
const dbManager = new DatabaseManager();

export default dbManager;