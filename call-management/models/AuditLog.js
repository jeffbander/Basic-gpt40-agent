import dbManager from '../database/connection.js';

export class AuditLog {
    constructor(data = {}) {
        this.id = data.id;
        this.eventType = data.eventType;
        this.entityType = data.entityType;
        this.entityId = data.entityId;
        this.userId = data.userId;
        this.action = data.action;
        this.oldValues = data.oldValues;
        this.newValues = data.newValues;
        this.ipAddress = data.ipAddress;
        this.userAgent = data.userAgent;
        this.sessionId = data.sessionId;
        this.success = data.success !== undefined ? data.success : true;
        this.errorMessage = data.errorMessage;
        this.metadata = data.metadata;
        this.createdAt = data.createdAt;
    }

    async save() {
        const sql = `
            INSERT INTO audit_log (
                event_type, entity_type, entity_id, user_id, action,
                old_values, new_values, ip_address, user_agent, session_id,
                success, error_message, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            this.eventType,
            this.entityType,
            this.entityId,
            this.userId,
            this.action,
            typeof this.oldValues === 'object' ? JSON.stringify(this.oldValues) : this.oldValues,
            typeof this.newValues === 'object' ? JSON.stringify(this.newValues) : this.newValues,
            this.ipAddress,
            this.userAgent,
            this.sessionId,
            this.success,
            this.errorMessage,
            typeof this.metadata === 'object' ? JSON.stringify(this.metadata) : this.metadata
        ];

        try {
            const result = await dbManager.run(sql, params);
            this.id = result.lastID;
            return this;
        } catch (error) {
            console.error('Error saving audit log:', error);
            throw error;
        }
    }

    static async log(eventType, entityType, entityId, action, details = {}) {
        const auditLog = new AuditLog({
            eventType,
            entityType,
            entityId,
            action,
            ...details
        });

        return auditLog.save();
    }

    static async logWebhookReceived(webhookId, agentData, metadata = {}) {
        return this.log(
            'webhook_received',
            'webhook',
            webhookId,
            'create',
            {
                newValues: { agentData },
                metadata: {
                    ...metadata,
                    timestamp: new Date().toISOString()
                }
            }
        );
    }

    static async logCallScheduled(webhookId, scheduledTime, callRuleId, metadata = {}) {
        return this.log(
            'call_scheduled',
            'webhook',
            webhookId,
            'update',
            {
                newValues: { scheduledTime, callRuleId },
                metadata: {
                    ...metadata,
                    timestamp: new Date().toISOString()
                }
            }
        );
    }

    static async logCallAttempted(callSid, webhookId, status, metadata = {}) {
        return this.log(
            'call_attempted',
            'call',
            callSid,
            'create',
            {
                newValues: { webhookId, status },
                metadata: {
                    ...metadata,
                    timestamp: new Date().toISOString()
                }
            }
        );
    }

    static async logRuleChanged(ruleId, oldValues, newValues, userId, metadata = {}) {
        return this.log(
            'rule_changed',
            'rule',
            ruleId,
            'update',
            {
                oldValues,
                newValues,
                userId,
                metadata: {
                    ...metadata,
                    timestamp: new Date().toISOString()
                }
            }
        );
    }

    static async logDuplicateDetected(duplicateHash, phoneNumber, metadata = {}) {
        return this.log(
            'duplicate_detected',
            'webhook',
            null,
            'reject',
            {
                newValues: { duplicateHash, phoneNumber },
                metadata: {
                    ...metadata,
                    timestamp: new Date().toISOString()
                }
            }
        );
    }

    static async logSystemEvent(eventType, details, metadata = {}) {
        return this.log(
            eventType,
            'system',
            null,
            'system',
            {
                newValues: details,
                metadata: {
                    ...metadata,
                    timestamp: new Date().toISOString()
                }
            }
        );
    }

    static async getRecentLogs(limit = 100, eventType = null) {
        let sql = `
            SELECT * FROM audit_log
        `;
        const params = [];

        if (eventType) {
            sql += ' WHERE event_type = ?';
            params.push(eventType);
        }

        sql += ' ORDER BY created_at DESC LIMIT ?';
        params.push(limit);

        try {
            const rows = await dbManager.all(sql, params);
            return rows.map(row => {
                // Parse JSON fields
                const parsed = { ...row };
                if (parsed.old_values) {
                    try {
                        parsed.old_values = JSON.parse(parsed.old_values);
                    } catch (e) {
                        // Keep as string if not valid JSON
                    }
                }
                if (parsed.new_values) {
                    try {
                        parsed.new_values = JSON.parse(parsed.new_values);
                    } catch (e) {
                        // Keep as string if not valid JSON
                    }
                }
                if (parsed.metadata) {
                    try {
                        parsed.metadata = JSON.parse(parsed.metadata);
                    } catch (e) {
                        // Keep as string if not valid JSON
                    }
                }
                return new AuditLog(parsed);
            });
        } catch (error) {
            console.error('Error retrieving audit logs:', error);
            throw error;
        }
    }

    static async getLogsByEntity(entityType, entityId, limit = 50) {
        const sql = `
            SELECT * FROM audit_log
            WHERE entity_type = ? AND entity_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        `;

        try {
            const rows = await dbManager.all(sql, [entityType, entityId, limit]);
            return rows.map(row => new AuditLog(row));
        } catch (error) {
            console.error('Error retrieving entity audit logs:', error);
            throw error;
        }
    }

    // Compliance reporting methods
    static async generateComplianceReport(startDate, endDate) {
        const sql = `
            SELECT
                event_type,
                COUNT(*) as event_count,
                COUNT(CASE WHEN success = 1 THEN 1 END) as successful_events,
                COUNT(CASE WHEN success = 0 THEN 1 END) as failed_events
            FROM audit_log
            WHERE created_at BETWEEN ? AND ?
            GROUP BY event_type
            ORDER BY event_count DESC
        `;

        try {
            const rows = await dbManager.all(sql, [startDate, endDate]);
            return {
                reportPeriod: { startDate, endDate },
                eventSummary: rows,
                totalEvents: rows.reduce((sum, row) => sum + row.event_count, 0),
                generatedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error generating compliance report:', error);
            throw error;
        }
    }
}