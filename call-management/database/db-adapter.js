/**
 * Database Adapter - Provides unified interface for SQLite and Firestore
 * Switches between databases based on USE_FIRESTORE environment variable
 */

import sqliteManager from './connection.js';
import firestoreManager from './firestore-connection.js';

const USE_FIRESTORE = process.env.USE_FIRESTORE === 'true';

class DatabaseAdapter {
    constructor() {
        this.db = USE_FIRESTORE ? firestoreManager : sqliteManager;
        this.isFirestore = USE_FIRESTORE;
        console.log(`Database Adapter initialized with: ${USE_FIRESTORE ? 'Firestore' : 'SQLite'}`);
    }

    async connect() {
        return await this.db.connect();
    }

    async close() {
        return await this.db.close();
    }

    async healthCheck() {
        return await this.db.healthCheck();
    }

    // Unified CRUD operations
    async insert(collection, data) {
        if (this.isFirestore) {
            return await this.db.run(collection, 'insert', data);
        } else {
            // SQLite: Convert collection to table and construct INSERT query
            const fields = Object.keys(data);
            const values = Object.values(data);
            const placeholders = fields.map(() => '?').join(', ');
            const sql = `INSERT INTO ${collection} (${fields.join(', ')}) VALUES (${placeholders})`;

            return await this.db.run(sql, values);
        }
    }

    async update(collection, id, data) {
        if (this.isFirestore) {
            return await this.db.run(collection, 'update', { id, ...data });
        } else {
            // SQLite: Construct UPDATE query
            const fields = Object.keys(data);
            const values = Object.values(data);
            const setClause = fields.map(f => `${f} = ?`).join(', ');
            const sql = `UPDATE ${collection} SET ${setClause} WHERE id = ?`;

            return await this.db.run(sql, [...values, id]);
        }
    }

    async delete(collection, id) {
        if (this.isFirestore) {
            return await this.db.run(collection, 'delete', { id });
        } else {
            // SQLite: Construct DELETE query
            const sql = `DELETE FROM ${collection} WHERE id = ?`;
            return await this.db.run(sql, [id]);
        }
    }

    async get(collection, id) {
        if (this.isFirestore) {
            return await this.db.get(collection, id);
        } else {
            // SQLite: Construct SELECT query
            const sql = `SELECT * FROM ${collection} WHERE id = ? LIMIT 1`;
            return await this.db.get(sql, [id]);
        }
    }

    async getByField(collection, field, value) {
        if (this.isFirestore) {
            const results = await this.db.all(collection, { [field]: value }, null, 1);
            return results.length > 0 ? results[0] : null;
        } else {
            // SQLite: Construct SELECT query
            const sql = `SELECT * FROM ${collection} WHERE ${field} = ? LIMIT 1`;
            return await this.db.get(sql, [value]);
        }
    }

    async all(collection, filters = {}, orderBy = null, limit = null) {
        if (this.isFirestore) {
            return await this.db.all(collection, filters, orderBy, limit);
        } else {
            // SQLite: Construct SELECT query with WHERE clause
            let sql = `SELECT * FROM ${collection}`;
            const values = [];

            if (Object.keys(filters).length > 0) {
                const whereClauses = Object.entries(filters).map(([field, value]) => {
                    if (typeof value === 'object' && value.operator) {
                        values.push(value.value);
                        return `${field} ${value.operator} ?`;
                    } else {
                        values.push(value);
                        return `${field} = ?`;
                    }
                });
                sql += ' WHERE ' + whereClauses.join(' AND ');
            }

            if (orderBy) {
                sql += ` ORDER BY ${orderBy.field} ${orderBy.direction || 'ASC'}`;
            }

            if (limit) {
                sql += ` LIMIT ${limit}`;
            }

            return await this.db.all(sql, values);
        }
    }

    // Transaction support
    async withTransaction(callback) {
        return await this.db.withTransaction(callback);
    }

    // Special helpers for common operations
    serverTimestamp() {
        if (this.isFirestore) {
            return this.db.serverTimestamp();
        } else {
            // SQLite uses CURRENT_TIMESTAMP
            return new Date().toISOString();
        }
    }

    increment(value = 1) {
        if (this.isFirestore) {
            return this.db.increment(value);
        } else {
            // For SQLite, we'll handle this differently in queries
            return value;
        }
    }

    // Direct access to underlying database (for advanced operations)
    getRawDB() {
        return this.db;
    }

    isUsingFirestore() {
        return this.isFirestore;
    }
}

// Singleton instance
const dbAdapter = new DatabaseAdapter();

export default dbAdapter;
