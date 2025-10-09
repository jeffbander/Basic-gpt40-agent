import { randomUUID } from 'crypto';
import dbManager from '../database/connection.js';
import { AuditLog } from './AuditLog.js';

export class WebhookQueue {
    constructor(data = {}) {
        this.id = data.id;
        this.webhookId = data.webhookId || data.webhook_id || randomUUID();
        this.patientId = data.patientId || data.patient_id;
        this.phoneNumber = data.phoneNumber || data.phone_number;
        this.patientName = data.patientName || data.patient_name;
        this.agentData = data.agentData || data.agent_data;
        this.parsedData = data.parsedData || data.parsed_data;
        this.priority = data.priority || 0; // 0=normal, 1=high, 2=emergency
        this.status = data.status || 'queued'; // queued, scheduled, processing, completed, failed
        this.scheduledTime = data.scheduledTime || data.scheduled_time;
        this.callRuleId = data.callRuleId || data.call_rule_id;
        this.duplicateHash = data.duplicateHash || data.duplicate_hash;
        this.retryCount = data.retryCount || data.retry_count || 0;
        this.lastAttemptTime = data.lastAttemptTime || data.last_attempt_time;
        this.lastFailureReason = data.lastFailureReason || data.last_failure_reason;
        this.createdAt = data.createdAt || data.created_at;
        this.updatedAt = data.updatedAt || data.updated_at;
    }

    async save() {
        const isUpdate = !!this.id;

        const sql = isUpdate
            ? `UPDATE webhook_queue SET
                patient_id = ?, phone_number = ?, patient_name = ?, agent_data = ?,
                parsed_data = ?, priority = ?, status = ?, scheduled_time = ?,
                call_rule_id = ?, duplicate_hash = ?, retry_count = ?,
                last_attempt_time = ?, last_failure_reason = ?
               WHERE id = ?`
            : `INSERT INTO webhook_queue (
                webhook_id, patient_id, phone_number, patient_name, agent_data,
                parsed_data, priority, status, scheduled_time, call_rule_id,
                duplicate_hash, retry_count, last_attempt_time, last_failure_reason
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const params = isUpdate
            ? [
                this.patientId,
                this.phoneNumber,
                this.patientName,
                typeof this.agentData === 'object' ? JSON.stringify(this.agentData) : this.agentData,
                typeof this.parsedData === 'object' ? JSON.stringify(this.parsedData) : this.parsedData,
                this.priority,
                this.status,
                this.scheduledTime,
                this.callRuleId,
                this.duplicateHash,
                this.retryCount,
                this.lastAttemptTime,
                this.lastFailureReason,
                this.id
            ]
            : [
                this.webhookId,
                this.patientId,
                this.phoneNumber,
                this.patientName,
                typeof this.agentData === 'object' ? JSON.stringify(this.agentData) : this.agentData,
                typeof this.parsedData === 'object' ? JSON.stringify(this.parsedData) : this.parsedData,
                this.priority,
                this.status,
                this.scheduledTime,
                this.callRuleId,
                this.duplicateHash,
                this.retryCount,
                this.lastAttemptTime,
                this.lastFailureReason
            ];

        try {
            const result = await dbManager.run(sql, params);

            if (!isUpdate) {
                this.id = result.lastID;
            }

            return this;
        } catch (error) {
            console.error('Error saving webhook queue entry:', error);
            throw error;
        }
    }

    static async findById(id) {
        const sql = 'SELECT * FROM webhook_queue WHERE id = ?';
        try {
            const row = await dbManager.get(sql, [id]);
            return row ? new WebhookQueue(row) : null;
        } catch (error) {
            console.error('Error finding webhook queue entry by ID:', error);
            throw error;
        }
    }

    static async findByWebhookId(webhookId) {
        const sql = 'SELECT * FROM webhook_queue WHERE webhook_id = ?';
        try {
            const row = await dbManager.get(sql, [webhookId]);
            return row ? new WebhookQueue(row) : null;
        } catch (error) {
            console.error('Error finding webhook queue entry by webhook ID:', error);
            throw error;
        }
    }

    static async findByStatus(status, limit = 100) {
        const sql = 'SELECT * FROM webhook_queue WHERE status = ? ORDER BY scheduled_time ASC LIMIT ?';
        try {
            const rows = await dbManager.all(sql, [status, limit]);
            return rows.map(row => new WebhookQueue(row));
        } catch (error) {
            console.error('Error finding webhook queue entries by status:', error);
            throw error;
        }
    }

    static async findPendingCalls(currentTime = new Date()) {
        const sql = `
            SELECT * FROM webhook_queue
            WHERE status IN ('queued', 'scheduled')
            AND scheduled_time <= ?
            ORDER BY priority DESC, scheduled_time ASC
            LIMIT 50
        `;

        try {
            const rows = await dbManager.all(sql, [currentTime.toISOString()]);
            return rows.map(row => new WebhookQueue(row));
        } catch (error) {
            console.error('Error finding pending calls:', error);
            throw error;
        }
    }

    static async findByPhoneNumber(phoneNumber, hours = 24) {
        const sinceTime = new Date(Date.now() - (hours * 60 * 60 * 1000)).toISOString();
        const sql = `
            SELECT * FROM webhook_queue
            WHERE phone_number = ? AND created_at >= ?
            ORDER BY created_at DESC
        `;

        try {
            const rows = await dbManager.all(sql, [phoneNumber, sinceTime]);
            return rows.map(row => new WebhookQueue(row));
        } catch (error) {
            console.error('Error finding webhook queue entries by phone number:', error);
            throw error;
        }
    }

    static async checkDuplicate(duplicateHash, windowMinutes = 60) {
        const sinceTime = new Date(Date.now() - (windowMinutes * 60 * 1000)).toISOString();
        const sql = `
            SELECT * FROM webhook_queue
            WHERE duplicate_hash = ? AND created_at >= ?
            ORDER BY created_at DESC
            LIMIT 1
        `;

        try {
            const row = await dbManager.get(sql, [duplicateHash, sinceTime]);
            return row ? new WebhookQueue(row) : null;
        } catch (error) {
            console.error('Error checking for duplicate:', error);
            throw error;
        }
    }

    async updateStatus(newStatus, failureReason = null) {
        const oldStatus = this.status;
        this.status = newStatus;

        if (failureReason) {
            this.lastFailureReason = failureReason;
        }

        if (['processing', 'failed', 'completed'].includes(newStatus)) {
            this.lastAttemptTime = new Date().toISOString();
        }

        await this.save();

        // Audit logging
        await AuditLog.log(
            'webhook_status_changed',
            'webhook',
            this.webhookId,
            'update',
            {
                oldValues: { status: oldStatus },
                newValues: { status: newStatus, failureReason },
                metadata: {
                    phoneNumber: this.phoneNumber,
                    retryCount: this.retryCount
                }
            }
        );

        return this;
    }

    async incrementRetry(nextScheduledTime, failureReason) {
        this.retryCount += 1;
        this.scheduledTime = nextScheduledTime;
        this.status = 'scheduled';
        this.lastFailureReason = failureReason;
        this.lastAttemptTime = new Date().toISOString();

        await this.save();

        // Audit logging
        await AuditLog.log(
            'webhook_retry_scheduled',
            'webhook',
            this.webhookId,
            'update',
            {
                newValues: {
                    retryCount: this.retryCount,
                    nextScheduledTime,
                    failureReason
                },
                metadata: {
                    phoneNumber: this.phoneNumber
                }
            }
        );

        return this;
    }

    async markCompleted(callSid = null) {
        await this.updateStatus('completed');

        if (callSid) {
            // Log successful call completion
            await AuditLog.logCallAttempted(
                callSid,
                this.webhookId,
                'completed',
                {
                    phoneNumber: this.phoneNumber,
                    retryCount: this.retryCount
                }
            );
        }

        return this;
    }

    async markFailed(reason, isMaxRetries = false) {
        await this.updateStatus('failed', reason);

        // Log the failure
        await AuditLog.log(
            'webhook_failed',
            'webhook',
            this.webhookId,
            'update',
            {
                newValues: { failureReason: reason, isMaxRetries },
                metadata: {
                    phoneNumber: this.phoneNumber,
                    retryCount: this.retryCount
                }
            }
        );

        return this;
    }

    getParsedData() {
        if (typeof this.parsedData === 'string') {
            try {
                return JSON.parse(this.parsedData);
            } catch (e) {
                return {};
            }
        }
        return this.parsedData || {};
    }

    getAgentData() {
        if (typeof this.agentData === 'string') {
            try {
                return JSON.parse(this.agentData);
            } catch (e) {
                return {};
            }
        }
        return this.agentData || {};
    }

    isEmergency() {
        return this.priority === 2;
    }

    isHighPriority() {
        return this.priority >= 1;
    }

    canRetry(maxRetries) {
        return this.retryCount < maxRetries;
    }

    getTimeUntilScheduled() {
        if (!this.scheduledTime) return 0;
        const scheduledDate = new Date(this.scheduledTime);
        const now = new Date();
        return Math.max(0, scheduledDate.getTime() - now.getTime());
    }

    static async getQueueStats() {
        const sql = `
            SELECT
                status,
                priority,
                COUNT(*) as count
            FROM webhook_queue
            WHERE created_at >= datetime('now', '-24 hours')
            GROUP BY status, priority
            ORDER BY status, priority
        `;

        try {
            const rows = await dbManager.all(sql);
            return {
                details: rows,
                summary: {
                    total: rows.reduce((sum, row) => sum + row.count, 0),
                    byStatus: rows.reduce((acc, row) => {
                        acc[row.status] = (acc[row.status] || 0) + row.count;
                        return acc;
                    }, {}),
                    byPriority: rows.reduce((acc, row) => {
                        const priorityName = row.priority === 2 ? 'emergency' : row.priority === 1 ? 'high' : 'normal';
                        acc[priorityName] = (acc[priorityName] || 0) + row.count;
                        return acc;
                    }, {})
                }
            };
        } catch (error) {
            console.error('Error getting queue stats:', error);
            throw error;
        }
    }

    static async cleanupOldEntries(daysToKeep = 30) {
        const cutoffDate = new Date(Date.now() - (daysToKeep * 24 * 60 * 60 * 1000)).toISOString();
        const sql = `
            DELETE FROM webhook_queue
            WHERE created_at < ? AND status IN ('completed', 'failed')
        `;

        try {
            const result = await dbManager.run(sql, [cutoffDate]);
            console.log(`Cleaned up ${result.changes} old webhook queue entries`);
            return result.changes;
        } catch (error) {
            console.error('Error cleaning up old entries:', error);
            throw error;
        }
    }

    toJSON() {
        return {
            id: this.id,
            webhookId: this.webhookId,
            patientId: this.patientId,
            phoneNumber: this.phoneNumber,
            patientName: this.patientName,
            agentData: this.getAgentData(),
            parsedData: this.getParsedData(),
            priority: this.priority,
            status: this.status,
            scheduledTime: this.scheduledTime,
            callRuleId: this.callRuleId,
            duplicateHash: this.duplicateHash,
            retryCount: this.retryCount,
            lastAttemptTime: this.lastAttemptTime,
            lastFailureReason: this.lastFailureReason,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}