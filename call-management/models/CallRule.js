import dbManager from '../database/connection.js';
import { AuditLog } from './AuditLog.js';

export class CallRule {
    constructor(data = {}) {
        this.id = data.id;
        this.name = data.name;
        this.description = data.description;
        this.callingHoursStart = data.callingHoursStart || data.calling_hours_start || '09:00';
        this.callingHoursEnd = data.callingHoursEnd || data.calling_hours_end || '17:00';
        this.timezone = data.timezone || 'America/New_York';
        this.maxRetryAttempts = data.maxRetryAttempts || data.max_retry_attempts || 3;
        this.retryIntervalMinutes = data.retryIntervalMinutes || data.retry_interval_minutes || 30;
        this.retryIntervalNoAnswer = data.retryIntervalNoAnswer || data.retry_interval_no_answer || 30;
        this.retryIntervalBusy = data.retryIntervalBusy || data.retry_interval_busy || 15;
        this.retryIntervalFailed = data.retryIntervalFailed || data.retry_interval_failed || 60;
        this.duplicateWindowMinutes = data.duplicateWindowMinutes || data.duplicate_window_minutes || 60;
        this.isActive = data.isActive !== undefined ? data.isActive : (data.is_active !== undefined ? data.is_active : true);
        this.emergencyOverrideEnabled = data.emergencyOverrideEnabled !== undefined ? data.emergencyOverrideEnabled : (data.emergency_override_enabled !== undefined ? data.emergency_override_enabled : true);
        this.createdAt = data.createdAt || data.created_at;
        this.updatedAt = data.updatedAt || data.updated_at;
    }

    async save(userId = 'system') {
        const isUpdate = !!this.id;
        let oldValues = null;

        // For audit logging, get old values if updating
        if (isUpdate) {
            const existing = await CallRule.findById(this.id);
            if (existing) {
                oldValues = {
                    name: existing.name,
                    callingHoursStart: existing.callingHoursStart,
                    callingHoursEnd: existing.callingHoursEnd,
                    timezone: existing.timezone,
                    maxRetryAttempts: existing.maxRetryAttempts,
                    isActive: existing.isActive
                };
            }
        }

        const sql = isUpdate
            ? `UPDATE call_rules SET
                name = ?, description = ?, calling_hours_start = ?, calling_hours_end = ?,
                timezone = ?, max_retry_attempts = ?, retry_interval_minutes = ?,
                retry_interval_no_answer = ?, retry_interval_busy = ?, retry_interval_failed = ?,
                duplicate_window_minutes = ?, is_active = ?, emergency_override_enabled = ?
               WHERE id = ?`
            : `INSERT INTO call_rules (
                name, description, calling_hours_start, calling_hours_end,
                timezone, max_retry_attempts, retry_interval_minutes,
                retry_interval_no_answer, retry_interval_busy, retry_interval_failed,
                duplicate_window_minutes, is_active, emergency_override_enabled
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const params = [
            this.name,
            this.description,
            this.callingHoursStart,
            this.callingHoursEnd,
            this.timezone,
            this.maxRetryAttempts,
            this.retryIntervalMinutes,
            this.retryIntervalNoAnswer,
            this.retryIntervalBusy,
            this.retryIntervalFailed,
            this.duplicateWindowMinutes,
            this.isActive,
            this.emergencyOverrideEnabled
        ];

        if (isUpdate) {
            params.push(this.id);
        }

        try {
            const result = await dbManager.run(sql, params);

            if (!isUpdate) {
                this.id = result.lastID;
            }

            // Audit logging
            const newValues = {
                name: this.name,
                callingHoursStart: this.callingHoursStart,
                callingHoursEnd: this.callingHoursEnd,
                timezone: this.timezone,
                maxRetryAttempts: this.maxRetryAttempts,
                isActive: this.isActive
            };

            await AuditLog.logRuleChanged(
                this.id,
                oldValues,
                newValues,
                userId,
                { action: isUpdate ? 'update' : 'create' }
            );

            return this;
        } catch (error) {
            console.error('Error saving call rule:', error);
            throw error;
        }
    }

    static async findById(id) {
        const sql = 'SELECT * FROM call_rules WHERE id = ?';
        try {
            const row = await dbManager.get(sql, [id]);
            return row ? new CallRule(row) : null;
        } catch (error) {
            console.error('Error finding call rule by ID:', error);
            throw error;
        }
    }

    static async findByName(name) {
        const sql = 'SELECT * FROM call_rules WHERE name = ?';
        try {
            const row = await dbManager.get(sql, [name]);
            return row ? new CallRule(row) : null;
        } catch (error) {
            console.error('Error finding call rule by name:', error);
            throw error;
        }
    }

    static async findAll(activeOnly = false) {
        let sql = 'SELECT * FROM call_rules';
        const params = [];

        if (activeOnly) {
            sql += ' WHERE is_active = 1';
        }

        sql += ' ORDER BY name';

        try {
            const rows = await dbManager.all(sql, params);
            return rows.map(row => new CallRule(row));
        } catch (error) {
            console.error('Error finding all call rules:', error);
            throw error;
        }
    }

    static async getDefaultRule() {
        // Get the first active rule, or create one if none exists
        const rules = await this.findAll(true);

        if (rules.length > 0) {
            return rules[0];
        }

        // Create default rule if none exists
        const defaultRule = new CallRule({
            name: 'Default Business Hours',
            description: 'Standard business hours calling rule',
            callingHoursStart: '09:00',
            callingHoursEnd: '17:00',
            timezone: 'America/New_York',
            maxRetryAttempts: 3,
            retryIntervalMinutes: 30,
            retryIntervalNoAnswer: 30,
            retryIntervalBusy: 15,
            retryIntervalFailed: 60,
            duplicateWindowMinutes: 60,
            isActive: true,
            emergencyOverrideEnabled: true
        });

        return defaultRule.save();
    }

    async delete(userId = 'system') {
        if (!this.id) {
            throw new Error('Cannot delete unsaved call rule');
        }

        const sql = 'DELETE FROM call_rules WHERE id = ?';

        try {
            await dbManager.run(sql, [this.id]);

            // Audit logging
            await AuditLog.logRuleChanged(
                this.id,
                { ...this },
                null,
                userId,
                { action: 'delete' }
            );

            return true;
        } catch (error) {
            console.error('Error deleting call rule:', error);
            throw error;
        }
    }

    // Business logic methods
    isWithinCallingHours(datetime = new Date()) {
        try {
            // Convert datetime to the rule's timezone
            const timeInTimezone = new Intl.DateTimeFormat('en-US', {
                timeZone: this.timezone,
                hour12: false,
                hour: '2-digit',
                minute: '2-digit'
            }).format(datetime);

            const currentTime = timeInTimezone;
            return currentTime >= this.callingHoursStart && currentTime <= this.callingHoursEnd;
        } catch (error) {
            console.error('Error checking calling hours:', error);
            // Default to within hours on error
            return true;
        }
    }

    getNextAvailableTime(fromTime = new Date()) {
        try {
            // If currently within calling hours, return immediately
            if (this.isWithinCallingHours(fromTime)) {
                return fromTime;
            }

            // Calculate next calling hours start time
            const nextDay = new Date(fromTime);
            nextDay.setDate(nextDay.getDate() + 1);

            // Parse start time
            const [hours, minutes] = this.callingHoursStart.split(':').map(Number);

            // Set to next day at start time in the rule's timezone
            const nextAvailable = new Date(nextDay);
            nextAvailable.setHours(hours, minutes, 0, 0);

            return nextAvailable;
        } catch (error) {
            console.error('Error calculating next available time:', error);
            // Default to 1 hour from now on error
            return new Date(fromTime.getTime() + 60 * 60 * 1000);
        }
    }

    getRetryInterval(failureType = 'default') {
        switch (failureType) {
            case 'no-answer':
                return this.retryIntervalNoAnswer;
            case 'busy':
                return this.retryIntervalBusy;
            case 'failed':
                return this.retryIntervalFailed;
            default:
                return this.retryIntervalMinutes;
        }
    }

    validate() {
        const errors = [];

        if (!this.name || this.name.trim().length === 0) {
            errors.push('Name is required');
        }

        if (!this.callingHoursStart || !this.callingHoursEnd) {
            errors.push('Calling hours start and end times are required');
        }

        if (this.callingHoursStart >= this.callingHoursEnd) {
            errors.push('Calling hours start time must be before end time');
        }

        if (this.maxRetryAttempts < 0 || this.maxRetryAttempts > 10) {
            errors.push('Max retry attempts must be between 0 and 10');
        }

        if (this.retryIntervalMinutes < 5 || this.retryIntervalMinutes > 1440) {
            errors.push('Retry interval must be between 5 minutes and 24 hours');
        }

        if (this.duplicateWindowMinutes < 1 || this.duplicateWindowMinutes > 1440) {
            errors.push('Duplicate window must be between 1 minute and 24 hours');
        }

        return errors;
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            callingHoursStart: this.callingHoursStart,
            callingHoursEnd: this.callingHoursEnd,
            timezone: this.timezone,
            maxRetryAttempts: this.maxRetryAttempts,
            retryIntervalMinutes: this.retryIntervalMinutes,
            retryIntervalNoAnswer: this.retryIntervalNoAnswer,
            retryIntervalBusy: this.retryIntervalBusy,
            retryIntervalFailed: this.retryIntervalFailed,
            duplicateWindowMinutes: this.duplicateWindowMinutes,
            isActive: this.isActive,
            emergencyOverrideEnabled: this.emergencyOverrideEnabled,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}