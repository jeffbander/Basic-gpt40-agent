-- Call Management System Database Schema
-- HIPAA-compliant design with audit logging

-- Call Rules table - defines when and how calls can be made
CREATE TABLE IF NOT EXISTS call_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    calling_hours_start TEXT NOT NULL DEFAULT '09:00', -- HH:MM format
    calling_hours_end TEXT NOT NULL DEFAULT '17:00',   -- HH:MM format
    timezone TEXT NOT NULL DEFAULT 'America/New_York',
    max_retry_attempts INTEGER NOT NULL DEFAULT 3,
    retry_interval_minutes INTEGER NOT NULL DEFAULT 30,
    retry_interval_no_answer INTEGER NOT NULL DEFAULT 30,
    retry_interval_busy INTEGER NOT NULL DEFAULT 15,
    retry_interval_failed INTEGER NOT NULL DEFAULT 60,
    duplicate_window_minutes INTEGER NOT NULL DEFAULT 60,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    emergency_override_enabled BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Webhook Queue table - stores incoming webhook requests
CREATE TABLE IF NOT EXISTS webhook_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    webhook_id TEXT NOT NULL UNIQUE, -- UUID for tracking
    patient_id TEXT,
    phone_number TEXT NOT NULL,
    patient_name TEXT,
    agent_data TEXT NOT NULL, -- JSON blob of original webhook data
    parsed_data TEXT NOT NULL, -- JSON blob of parsed fields
    priority INTEGER NOT NULL DEFAULT 0, -- 0=normal, 1=high, 2=emergency
    status TEXT NOT NULL DEFAULT 'queued', -- queued, scheduled, processing, completed, failed
    scheduled_time DATETIME NOT NULL,
    call_rule_id INTEGER REFERENCES call_rules(id),
    duplicate_hash TEXT NOT NULL, -- For duplicate detection
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_attempt_time DATETIME,
    last_failure_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Call Attempts table - tracks individual call attempts
CREATE TABLE IF NOT EXISTS call_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    webhook_queue_id INTEGER NOT NULL REFERENCES webhook_queue(id),
    twilio_call_sid TEXT UNIQUE,
    attempt_number INTEGER NOT NULL,
    call_status TEXT, -- initiated, ringing, answered, completed, failed, busy, no-answer
    call_duration INTEGER, -- seconds
    started_at DATETIME NOT NULL,
    ended_at DATETIME,
    failure_reason TEXT,
    twilio_error_code TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log table - comprehensive HIPAA-compliant logging
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL, -- webhook_received, call_scheduled, call_attempted, rule_changed, etc.
    entity_type TEXT NOT NULL, -- webhook, call, rule, system
    entity_id TEXT, -- ID of the affected entity
    user_id TEXT, -- For administrative actions
    action TEXT NOT NULL, -- create, update, delete, process
    old_values TEXT, -- JSON of previous state
    new_values TEXT, -- JSON of new state
    ip_address TEXT,
    user_agent TEXT,
    session_id TEXT,
    success BOOLEAN NOT NULL DEFAULT 1,
    error_message TEXT,
    metadata TEXT, -- Additional context as JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Duplicate Detection table - temporary storage for duplicate checking
CREATE TABLE IF NOT EXISTS duplicate_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    duplicate_hash TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    occurrence_count INTEGER NOT NULL DEFAULT 1,
    expires_at DATETIME NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhook_queue_status ON webhook_queue(status);
CREATE INDEX IF NOT EXISTS idx_webhook_queue_scheduled_time ON webhook_queue(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_webhook_queue_phone ON webhook_queue(phone_number);
CREATE INDEX IF NOT EXISTS idx_webhook_queue_duplicate_hash ON webhook_queue(duplicate_hash);
CREATE INDEX IF NOT EXISTS idx_call_attempts_webhook_id ON call_attempts(webhook_queue_id);
CREATE INDEX IF NOT EXISTS idx_call_attempts_call_sid ON call_attempts(twilio_call_sid);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_duplicate_tracking_hash ON duplicate_tracking(duplicate_hash);
CREATE INDEX IF NOT EXISTS idx_duplicate_tracking_expires ON duplicate_tracking(expires_at);

-- Insert default call rule
INSERT OR IGNORE INTO call_rules (
    id, name, description, calling_hours_start, calling_hours_end,
    timezone, max_retry_attempts, retry_interval_minutes
) VALUES (
    1, 'Default Business Hours', 'Standard business hours calling rule',
    '09:00', '17:00', 'America/New_York', 3, 30
);

-- Update triggers to maintain updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_call_rules_timestamp
    AFTER UPDATE ON call_rules
BEGIN
    UPDATE call_rules SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_webhook_queue_timestamp
    AFTER UPDATE ON webhook_queue
BEGIN
    UPDATE webhook_queue SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;