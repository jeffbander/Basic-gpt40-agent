import { SchedulingEngine } from '../services/SchedulingEngine.js';
import { AuditLog } from '../models/AuditLog.js';

export class CallManagerWebhookHandler {
    constructor() {
        this.schedulingEngine = new SchedulingEngine();
        this.initialized = false;
    }

    async initialize() {
        if (!this.initialized) {
            await this.schedulingEngine.initialize();
            this.initialized = true;
            console.log('CallManagerWebhookHandler initialized');
        }
    }

    /**
     * Enhanced webhook handler that integrates with existing AgentDataParser
     */
    async handleWebhook(agentData, parsedData, agentDataParser, request = {}) {
        const startTime = Date.now();
        const clientIP = request.ip || request.connection?.remoteAddress || 'unknown';
        const userAgent = request.headers?.['user-agent'] || 'unknown';

        try {
            // Ensure initialization
            await this.initialize();

            // Validate required data
            if (!agentData || !parsedData) {
                throw new Error('Missing required agent data or parsed data');
            }

            // Create enhanced metadata for audit logging
            const metadata = {
                clientIP,
                userAgent,
                requestId: request.id || `req_${Date.now()}`,
                processingStartTime: startTime,
                agentDataParserUsed: agentDataParser ? agentDataParser.constructor.name : 'none'
            };

            // Process through scheduling engine
            const result = await this.schedulingEngine.processWebhook(
                agentData,
                parsedData,
                metadata
            );

            // Calculate processing time
            const processingTime = Date.now() - startTime;

            // Enhanced response for call management
            const response = {
                success: true,
                webhookCallId: result.webhookCallId,
                status: result.status,
                scheduledTime: result.scheduledTime,
                priority: result.priority,
                estimatedWaitTime: result.estimatedWaitTime,
                callRuleApplied: result.callRuleApplied,
                message: result.message,
                processingTime: `${processingTime}ms`,
                checkStatusUrl: `/api/webhook/status/${result.webhookCallId}`,
                callManagement: {
                    queuePosition: await this.getQueuePosition(result.webhookCallId),
                    retryPolicy: await this.getRetryPolicy(result.webhookCallId),
                    duplicateWindow: this.getDuplicateWindow()
                },
                parsingReport: this.generateParsingReport(parsedData, agentDataParser)
            };

            // Log successful processing
            await AuditLog.logSystemEvent(
                'webhook_processed_successfully',
                {
                    webhookCallId: result.webhookCallId,
                    processingTime,
                    priority: result.priority,
                    scheduledTime: result.scheduledTime
                },
                metadata
            );

            return response;

        } catch (error) {
            const processingTime = Date.now() - startTime;

            console.error('Webhook processing error:', error);

            // Enhanced error response
            const errorResponse = {
                success: false,
                error: {
                    message: error.message,
                    type: this.classifyError(error),
                    code: this.getErrorCode(error)
                },
                processingTime: `${processingTime}ms`,
                parsingReport: parsedData ? this.generateParsingReport(parsedData, agentDataParser) : null,
                retryable: this.isRetryableError(error),
                suggestions: this.getErrorSuggestions(error, parsedData)
            };

            // Log error with context
            await AuditLog.logSystemEvent(
                'webhook_processing_error',
                {
                    error: error.message,
                    errorType: errorResponse.error.type,
                    processingTime,
                    agentData: agentData ? 'present' : 'missing',
                    parsedData: parsedData ? 'present' : 'missing'
                },
                {
                    clientIP,
                    userAgent,
                    success: false
                }
            );

            throw errorResponse;
        }
    }

    /**
     * Get queue position for a webhook call
     */
    async getQueuePosition(webhookCallId) {
        try {
            // This would need to be implemented based on queue ordering logic
            const pendingCalls = await this.schedulingEngine.getPendingCalls(100);
            const position = pendingCalls.findIndex(call => call.webhookId === webhookCallId);
            return position >= 0 ? position + 1 : null;
        } catch (error) {
            console.error('Error getting queue position:', error);
            return null;
        }
    }

    /**
     * Get retry policy information
     */
    async getRetryPolicy(webhookCallId) {
        try {
            // Return general retry policy info
            return {
                maxAttempts: 3,
                baseInterval: '30 minutes',
                intervalTypes: {
                    'no-answer': '30 minutes',
                    'busy': '15 minutes',
                    'failed': '60 minutes'
                }
            };
        } catch (error) {
            console.error('Error getting retry policy:', error);
            return null;
        }
    }

    /**
     * Get duplicate detection window
     */
    getDuplicateWindow() {
        return {
            windowMinutes: 60,
            description: 'Duplicate requests within 60 minutes will be rejected'
        };
    }

    /**
     * Generate parsing report for transparency
     */
    generateParsingReport(parsedData, agentDataParser) {
        if (!parsedData) {
            return {
                success: false,
                error: 'No parsed data available'
            };
        }

        const fieldsFound = {};
        const fieldsMissing = [];
        const warnings = [];

        // Check for required fields
        const requiredFields = ['phone', 'phoneNumber', 'phone_number', 'contact_number'];
        const phoneFound = requiredFields.some(field => {
            if (parsedData[field]) {
                fieldsFound.phone = field;
                return true;
            }
            return false;
        });

        if (!phoneFound) {
            fieldsMissing.push('phone number');
        }

        // Check for optional but recommended fields
        const optionalFields = {
            patientName: ['patientName', 'patient_name', 'name', 'fullName'],
            patientId: ['patientId', 'patient_id', 'id', 'mrn'],
            priority: ['priority', 'urgency', 'emergency']
        };

        Object.entries(optionalFields).forEach(([category, fields]) => {
            const found = fields.find(field => parsedData[field]);
            if (found) {
                fieldsFound[category] = found;
            } else {
                warnings.push(`No ${category} found in parsed data`);
            }
        });

        return {
            success: !fieldsMissing.length,
            fieldsFound,
            fieldsMissing,
            warnings,
            totalFieldsParsed: Object.keys(parsedData).length,
            parserUsed: agentDataParser ? agentDataParser.constructor.name : 'Manual parsing'
        };
    }

    /**
     * Classify error types
     */
    classifyError(error) {
        const message = error.message.toLowerCase();

        if (message.includes('duplicate')) {
            return 'DUPLICATE_REQUEST';
        } else if (message.includes('phone')) {
            return 'INVALID_PHONE_NUMBER';
        } else if (message.includes('validation')) {
            return 'VALIDATION_ERROR';
        } else if (message.includes('database') || message.includes('connection')) {
            return 'DATABASE_ERROR';
        } else if (message.includes('parsing')) {
            return 'PARSING_ERROR';
        } else {
            return 'PROCESSING_ERROR';
        }
    }

    /**
     * Get error code for categorization
     */
    getErrorCode(error) {
        const errorType = this.classifyError(error);
        const codes = {
            'DUPLICATE_REQUEST': 'E001',
            'INVALID_PHONE_NUMBER': 'E002',
            'VALIDATION_ERROR': 'E003',
            'DATABASE_ERROR': 'E004',
            'PARSING_ERROR': 'E005',
            'PROCESSING_ERROR': 'E999'
        };
        return codes[errorType] || 'E999';
    }

    /**
     * Determine if error is retryable
     */
    isRetryableError(error) {
        const errorType = this.classifyError(error);
        const retryableTypes = ['DATABASE_ERROR', 'PROCESSING_ERROR'];
        return retryableTypes.includes(errorType);
    }

    /**
     * Get error suggestions for debugging
     */
    getErrorSuggestions(error, parsedData) {
        const errorType = this.classifyError(error);
        const suggestions = [];

        switch (errorType) {
            case 'DUPLICATE_REQUEST':
                suggestions.push('Wait for the duplicate detection window to expire before retrying');
                suggestions.push('Check if the original call is still in progress');
                break;

            case 'INVALID_PHONE_NUMBER':
                suggestions.push('Ensure phone number is in valid format (e.g., +1234567890)');
                suggestions.push('Check phone number field names in webhook data');
                if (parsedData) {
                    const phoneFields = Object.keys(parsedData).filter(key =>
                        key.toLowerCase().includes('phone') || key.toLowerCase().includes('tel')
                    );
                    if (phoneFields.length) {
                        suggestions.push(`Found phone-related fields: ${phoneFields.join(', ')}`);
                    }
                }
                break;

            case 'PARSING_ERROR':
                suggestions.push('Verify webhook data format matches expected schema');
                suggestions.push('Check AgentDataParser field mappings');
                break;

            case 'DATABASE_ERROR':
                suggestions.push('Database may be temporarily unavailable - retry in a few minutes');
                suggestions.push('Check system status at /api/health');
                break;

            default:
                suggestions.push('Check system logs for detailed error information');
                suggestions.push('Contact system administrator if issue persists');
        }

        return suggestions;
    }

    /**
     * Health check for webhook handler
     */
    async healthCheck() {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            const engineHealth = await this.schedulingEngine.healthCheck();

            return {
                status: 'healthy',
                initialized: this.initialized,
                schedulingEngine: engineHealth,
                capabilities: {
                    webhookProcessing: true,
                    duplicateDetection: true,
                    priorityScheduling: true,
                    businessHours: true,
                    retryLogic: true,
                    auditLogging: true
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                initialized: this.initialized,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Get webhook status
     */
    async getWebhookStatus(webhookCallId) {
        try {
            const { WebhookQueue } = await import('../models/WebhookQueue.js');
            const webhookEntry = await WebhookQueue.findByWebhookId(webhookCallId);

            if (!webhookEntry) {
                return {
                    success: false,
                    error: 'Webhook call not found',
                    webhookCallId
                };
            }

            return {
                success: true,
                webhookCallId,
                status: webhookEntry.status,
                scheduledTime: webhookEntry.scheduledTime,
                priority: this.schedulingEngine.getPriorityName(webhookEntry.priority),
                retryCount: webhookEntry.retryCount,
                lastAttemptTime: webhookEntry.lastAttemptTime,
                lastFailureReason: webhookEntry.lastFailureReason,
                estimatedWaitTime: this.schedulingEngine.getEstimatedWaitTime(webhookEntry.scheduledTime),
                createdAt: webhookEntry.createdAt,
                updatedAt: webhookEntry.updatedAt
            };
        } catch (error) {
            console.error('Error getting webhook status:', error);
            return {
                success: false,
                error: error.message,
                webhookCallId
            };
        }
    }
}

// Singleton instance for use in existing system
export const callManagerWebhookHandler = new CallManagerWebhookHandler();