import { createHash } from 'crypto';
import { CallRule } from '../models/CallRule.js';
import { WebhookQueue } from '../models/WebhookQueue.js';
import { AuditLog } from '../models/AuditLog.js';
import dbManager from '../database/connection.js';

export class SchedulingEngine {
    constructor() {
        this.defaultCallRule = null;
    }

    async initialize() {
        try {
            await dbManager.connect();
            this.defaultCallRule = await CallRule.getDefaultRule();
            console.log('SchedulingEngine initialized with default rule:', this.defaultCallRule.name);
        } catch (error) {
            console.error('Error initializing SchedulingEngine:', error);
            throw error;
        }
    }

    /**
     * Process incoming webhook and determine scheduling
     */
    async processWebhook(agentData, parsedData, metadata = {}) {
        try {
            const phoneNumber = this.extractPhoneNumber(parsedData);
            if (!phoneNumber) {
                throw new Error('No valid phone number found in webhook data');
            }

            // Generate duplicate hash for detection
            const duplicateHash = this.generateDuplicateHash(parsedData);

            // Check for duplicates
            const callRule = await this.getCallRule(parsedData);
            const isDuplicate = await this.checkDuplicate(duplicateHash, callRule.duplicateWindowMinutes);

            if (isDuplicate) {
                await AuditLog.logDuplicateDetected(duplicateHash, phoneNumber, {
                    originalWebhookId: isDuplicate.webhookId,
                    timeSinceOriginal: new Date() - new Date(isDuplicate.createdAt)
                });

                throw new Error(`Duplicate webhook detected. Original call: ${isDuplicate.webhookId}`);
            }

            // Determine priority
            const priority = this.determinePriority(parsedData, agentData);

            // Calculate scheduled time based on calling hours and priority
            const scheduledTime = this.calculateScheduledTime(callRule, priority);

            // Create webhook queue entry
            const webhookEntry = new WebhookQueue({
                patientId: this.extractPatientId(parsedData),
                phoneNumber: phoneNumber,
                patientName: this.extractPatientName(parsedData),
                agentData: agentData,
                parsedData: parsedData,
                priority: priority,
                status: priority === 2 ? 'scheduled' : (scheduledTime <= new Date() ? 'queued' : 'scheduled'),
                scheduledTime: scheduledTime.toISOString(),
                callRuleId: callRule.id,
                duplicateHash: duplicateHash
            });

            await webhookEntry.save();

            // Audit logging
            await AuditLog.logWebhookReceived(webhookEntry.webhookId, agentData, {
                phoneNumber,
                priority,
                scheduledTime: scheduledTime.toISOString(),
                callRuleApplied: callRule.name
            });

            await AuditLog.logCallScheduled(
                webhookEntry.webhookId,
                scheduledTime.toISOString(),
                callRule.id,
                {
                    phoneNumber,
                    priorityLevel: this.getPriorityName(priority),
                    withinBusinessHours: callRule.isWithinCallingHours(),
                    emergencyOverride: priority === 2
                }
            );

            return {
                success: true,
                webhookCallId: webhookEntry.webhookId,
                status: webhookEntry.status,
                scheduledTime: scheduledTime.toISOString(),
                priority: this.getPriorityName(priority),
                estimatedWaitTime: this.getEstimatedWaitTime(scheduledTime),
                callRuleApplied: callRule.name,
                isDuplicate: false,
                message: this.getSchedulingMessage(webhookEntry.status, scheduledTime, callRule)
            };

        } catch (error) {
            console.error('Error processing webhook:', error);

            // Log the error
            await AuditLog.logSystemEvent(
                'webhook_processing_error',
                { error: error.message, agentData, parsedData },
                metadata
            );

            throw error;
        }
    }

    /**
     * Check for duplicate webhooks
     */
    async checkDuplicate(duplicateHash, windowMinutes) {
        return WebhookQueue.checkDuplicate(duplicateHash, windowMinutes);
    }

    /**
     * Generate duplicate detection hash
     */
    generateDuplicateHash(parsedData) {
        // Use phone number and key patient data for duplicate detection
        const hashData = {
            phone: this.extractPhoneNumber(parsedData),
            patientId: this.extractPatientId(parsedData),
            name: this.extractPatientName(parsedData)
        };

        // Create deterministic hash
        const hashString = JSON.stringify(hashData);
        return createHash('sha256').update(hashString).digest('hex').substring(0, 16);
    }

    /**
     * Determine call priority from parsed data
     */
    determinePriority(parsedData, agentData) {
        // Check for emergency indicators
        const emergencyKeywords = ['emergency', 'urgent', 'critical', 'stat', 'asap', 'immediate'];
        const agentDataString = JSON.stringify(agentData).toLowerCase();
        const parsedDataString = JSON.stringify(parsedData).toLowerCase();

        if (emergencyKeywords.some(keyword =>
            agentDataString.includes(keyword) || parsedDataString.includes(keyword)
        )) {
            return 2; // Emergency
        }

        // Check for high priority indicators
        const highPriorityKeywords = ['high', 'priority', 'important', 'follow-up', 'discharge'];
        if (highPriorityKeywords.some(keyword =>
            agentDataString.includes(keyword) || parsedDataString.includes(keyword)
        )) {
            return 1; // High priority
        }

        return 0; // Normal priority
    }

    /**
     * Calculate when the call should be scheduled
     */
    calculateScheduledTime(callRule, priority) {
        const now = new Date();

        // Emergency calls bypass calling hours
        if (priority === 2 && callRule.emergencyOverrideEnabled) {
            return now;
        }

        // Check if within calling hours
        if (callRule.isWithinCallingHours(now)) {
            return now; // Schedule immediately
        }

        // Outside calling hours - schedule for next available time
        return callRule.getNextAvailableTime(now);
    }

    /**
     * Get appropriate call rule (could be expanded for different rule selection)
     */
    async getCallRule(parsedData) {
        // For now, use default rule. Could be expanded to select rules based on patient type, etc.
        return this.defaultCallRule || await CallRule.getDefaultRule();
    }

    /**
     * Extract phone number from parsed data
     */
    extractPhoneNumber(parsedData) {
        // Try various phone field names
        const phoneFields = [
            'phone', 'phoneNumber', 'phone_number', 'contact_number',
            'primary_phone', 'mobile', 'cell', 'telephone'
        ];

        for (const field of phoneFields) {
            if (parsedData[field]) {
                return this.normalizePhoneNumber(parsedData[field]);
            }
        }

        // Check nested objects
        if (parsedData.contact && parsedData.contact.phone) {
            return this.normalizePhoneNumber(parsedData.contact.phone);
        }

        if (parsedData.patient && parsedData.patient.phone) {
            return this.normalizePhoneNumber(parsedData.patient.phone);
        }

        return null;
    }

    /**
     * Extract patient ID from parsed data
     */
    extractPatientId(parsedData) {
        const idFields = [
            'patientId', 'patient_id', 'id', 'mrn', 'medical_record_number',
            'chart_number', 'account_id'
        ];

        for (const field of idFields) {
            if (parsedData[field]) {
                return String(parsedData[field]);
            }
        }

        // Check nested objects
        if (parsedData.patient && parsedData.patient.id) {
            return String(parsedData.patient.id);
        }

        return null;
    }

    /**
     * Extract patient name from parsed data
     */
    extractPatientName(parsedData) {
        const nameFields = [
            'patientName', 'patient_name', 'name', 'fullName', 'full_name'
        ];

        for (const field of nameFields) {
            if (parsedData[field]) {
                return String(parsedData[field]);
            }
        }

        // Try to construct from first/last name
        if (parsedData.firstName && parsedData.lastName) {
            return `${parsedData.firstName} ${parsedData.lastName}`;
        }

        if (parsedData.first_name && parsedData.last_name) {
            return `${parsedData.first_name} ${parsedData.last_name}`;
        }

        // Check nested objects
        if (parsedData.patient) {
            if (parsedData.patient.name) {
                return String(parsedData.patient.name);
            }
            if (parsedData.patient.firstName && parsedData.patient.lastName) {
                return `${parsedData.patient.firstName} ${parsedData.patient.lastName}`;
            }
        }

        return 'Unknown Patient';
    }

    /**
     * Normalize phone number format
     */
    normalizePhoneNumber(phone) {
        if (!phone) return null;

        // Remove all non-digits
        const digits = phone.replace(/\D/g, '');

        // Validate phone number (US format)
        if (digits.length === 10) {
            return `+1${digits}`;
        } else if (digits.length === 11 && digits.startsWith('1')) {
            return `+${digits}`;
        } else if (digits.startsWith('+')) {
            return phone; // Already formatted
        }

        return null; // Invalid phone number
    }

    /**
     * Get priority name for display
     */
    getPriorityName(priority) {
        switch (priority) {
            case 2: return 'emergency';
            case 1: return 'high';
            default: return 'normal';
        }
    }

    /**
     * Get estimated wait time in minutes
     */
    getEstimatedWaitTime(scheduledTime) {
        const now = new Date();
        const waitTimeMs = new Date(scheduledTime) - now;
        return Math.max(0, Math.ceil(waitTimeMs / (1000 * 60)));
    }

    /**
     * Get user-friendly scheduling message
     */
    getSchedulingMessage(status, scheduledTime, callRule) {
        const waitTime = this.getEstimatedWaitTime(scheduledTime);

        if (status === 'queued') {
            return 'Call will be initiated immediately';
        } else if (waitTime === 0) {
            return 'Call is being processed now';
        } else if (waitTime < 60) {
            return `Call scheduled for ${waitTime} minutes from now`;
        } else {
            const hours = Math.floor(waitTime / 60);
            const minutes = waitTime % 60;
            return `Call scheduled for ${hours}h ${minutes}m from now during business hours (${callRule.callingHoursStart}-${callRule.callingHoursEnd} ${callRule.timezone})`;
        }
    }

    /**
     * Get pending calls ready for processing
     */
    async getPendingCalls(limit = 50) {
        return WebhookQueue.findPendingCalls(new Date());
    }

    /**
     * Get queue statistics
     */
    async getQueueStats() {
        return WebhookQueue.getQueueStats();
    }

    /**
     * Clean up old completed entries
     */
    async cleanupOldEntries(daysToKeep = 30) {
        return WebhookQueue.cleanupOldEntries(daysToKeep);
    }

    /**
     * Health check for the scheduling engine
     */
    async healthCheck() {
        try {
            const dbHealth = await dbManager.healthCheck();
            const pendingCount = (await this.getPendingCalls(1)).length;
            const stats = await this.getQueueStats();

            return {
                status: 'healthy',
                database: dbHealth,
                pendingCalls: pendingCount > 0,
                queueStats: stats.summary,
                defaultRule: this.defaultCallRule ? this.defaultCallRule.name : 'Not loaded',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}