import fetch from 'node-fetch';

/**
 * Service for sending call outcome notifications back to agents
 */
export class WebhookNotificationService {
    constructor() {
        this.retryAttempts = 3;
        this.retryDelayMs = 2000; // 2 seconds
    }

    /**
     * Send successful call outcome with transcript to agent
     */
    async sendSuccessNotification(agentWebhookUrl, callOutcome) {
        const payload = {
            event: 'call_completed',
            status: 'success',
            timestamp: new Date().toISOString(),
            data: {
                webhookCallId: callOutcome.webhookCallId,
                callSid: callOutcome.callSid,
                duration: callOutcome.duration,
                patient: {
                    id: callOutcome.patientId,
                    name: callOutcome.patientName,
                    phoneNumber: callOutcome.phoneNumber
                },
                transcript: callOutcome.transcript,
                summary: callOutcome.summary,
                medicalFindings: callOutcome.medicalFindings,
                callCompleted: true,
                attemptNumber: 1,
                totalAttempts: 1
            }
        };

        return this.sendWebhookWithRetry(agentWebhookUrl, payload);
    }

    /**
     * Send failed call outcome after 3 attempts
     */
    async sendFailureNotification(agentWebhookUrl, callOutcome) {
        const payload = {
            event: 'call_failed',
            status: 'failed',
            timestamp: new Date().toISOString(),
            data: {
                webhookCallId: callOutcome.webhookCallId,
                patient: {
                    id: callOutcome.patientId,
                    name: callOutcome.patientName,
                    phoneNumber: callOutcome.phoneNumber
                },
                callCompleted: false,
                attemptNumber: callOutcome.attemptNumber || 3,
                totalAttempts: 3,
                failureReason: callOutcome.failureReason,
                lastAttemptTime: callOutcome.lastAttemptTime,
                errorDetails: callOutcome.errorDetails
            }
        };

        return this.sendWebhookWithRetry(agentWebhookUrl, payload);
    }

    /**
     * Send no-answer notification
     */
    async sendNoAnswerNotification(agentWebhookUrl, callOutcome) {
        const payload = {
            event: 'call_no_answer',
            status: 'no_answer',
            timestamp: new Date().toISOString(),
            data: {
                webhookCallId: callOutcome.webhookCallId,
                patient: {
                    id: callOutcome.patientId,
                    name: callOutcome.patientName,
                    phoneNumber: callOutcome.phoneNumber
                },
                callCompleted: false,
                attemptNumber: callOutcome.attemptNumber || 1,
                totalAttempts: 3,
                failureReason: 'no-answer'
            }
        };

        return this.sendWebhookWithRetry(agentWebhookUrl, payload);
    }

    /**
     * Send webhook with retry logic
     */
    async sendWebhookWithRetry(webhookUrl, payload) {
        let lastError = null;

        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                console.log(`[WEBHOOK-NOTIFY] Sending ${payload.event} to agent (attempt ${attempt}/${this.retryAttempts})`);
                console.log(`[WEBHOOK-NOTIFY] URL: ${webhookUrl}`);

                const response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'MedicalCallSystem/2.0'
                    },
                    body: JSON.stringify(payload),
                    timeout: 10000 // 10 second timeout
                });

                if (response.ok) {
                    console.log(`[WEBHOOK-NOTIFY] ✅ Successfully sent ${payload.event} notification to agent`);

                    // Try to get response data if available
                    let responseData = null;
                    try {
                        responseData = await response.json();
                    } catch (e) {
                        responseData = await response.text();
                    }

                    return {
                        success: true,
                        attempt,
                        status: response.status,
                        response: responseData
                    };
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

            } catch (error) {
                lastError = error;
                console.log(`[WEBHOOK-NOTIFY] ❌ Attempt ${attempt} failed: ${error.message}`);

                if (attempt < this.retryAttempts) {
                    console.log(`[WEBHOOK-NOTIFY] Retrying in ${this.retryDelayMs}ms...`);
                    await this.sleep(this.retryDelayMs);
                }
            }
        }

        console.log(`[WEBHOOK-NOTIFY] ❌ All ${this.retryAttempts} attempts failed for ${payload.event}`);
        return {
            success: false,
            attempts: this.retryAttempts,
            lastError: lastError.message
        };
    }

    /**
     * Helper function to sleep
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Validate webhook URL format
     */
    isValidWebhookUrl(url) {
        try {
            const parsedUrl = new URL(url);
            return ['http:', 'https:'].includes(parsedUrl.protocol);
        } catch (error) {
            return false;
        }
    }

    /**
     * Prepare call outcome data for successful calls
     */
    prepareSuccessOutcome(webhookCallId, patient, callResult, transcript) {
        return {
            webhookCallId,
            callSid: callResult.callSid,
            duration: callResult.duration,
            patientId: patient.id,
            patientName: patient.name,
            phoneNumber: patient.phoneNumber,
            transcript: transcript ? this.formatTranscript(transcript) : null,
            summary: transcript ? transcript.summary : null,
            medicalFindings: transcript ? transcript.medicalFindings : null
        };
    }

    /**
     * Prepare call outcome data for failed calls
     */
    prepareFailureOutcome(webhookCallId, patient, failureReason, attemptNumber = 3, errorDetails = null) {
        return {
            webhookCallId,
            patientId: patient.id,
            patientName: patient.name,
            phoneNumber: patient.phoneNumber,
            failureReason,
            attemptNumber,
            lastAttemptTime: new Date().toISOString(),
            errorDetails
        };
    }

    /**
     * Format transcript for agent consumption
     */
    formatTranscript(transcript) {
        if (!transcript || !transcript.conversation) {
            return null;
        }

        return {
            conversation: transcript.conversation.map(entry => ({
                role: entry.role,
                text: this.extractTextFromContent(entry.content),
                timestamp: entry.timestamp
            })),
            summary: transcript.summary,
            totalExchanges: transcript.conversation.length,
            callDuration: transcript.enhanced?.metadata?.duration,
            transcriptSuccessRate: transcript.enhanced?.transcriptionSuccessRate
        };
    }

    /**
     * Extract readable text from conversation content
     */
    extractTextFromContent(content) {
        if (!content || !Array.isArray(content)) {
            return '';
        }

        const textContent = content[0];
        if (textContent.transcript) {
            return textContent.transcript;
        } else if (textContent.text) {
            return textContent.text;
        } else {
            return JSON.stringify(textContent);
        }
    }
}

// Export singleton instance
export const webhookNotificationService = new WebhookNotificationService();