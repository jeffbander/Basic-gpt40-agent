#!/usr/bin/env node

/**
 * Multi-App Ngrok URL Updater
 * Updates .env files for multiple applications automatically
 */

import fetch from 'node-fetch';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NGROK_API = 'http://localhost:4040/api/tunnels';

// Configuration for all apps
const APP_CONFIGS = [
    {
        name: 'Medical App',
        tunnelName: 'medical-app',
        port: 5051,
        envFile: path.join(__dirname, '.env'),
        envVariable: 'BASE_URL',
        createLocalEnv: false
    },
    {
        name: 'HeartVoice Monitor',
        tunnelName: 'heartvoice-monitor',
        port: 3004,
        envFile: 'C:\\Users\\jeffr\\Downloads\\CHF-working\\heartvoice-monitor\\.env.local',
        envVariable: 'NEXT_PUBLIC_BASE_URL',
        createLocalEnv: true,
        fallbackEnvFile: 'C:\\Users\\jeffr\\Downloads\\CHF-working\\heartvoice-monitor\\.env'
    },
    {
        name: 'HeartVoice WebSocket',
        tunnelName: 'heartvoice-websocket',
        port: 8080,
        envFile: 'C:\\Users\\jeffr\\Downloads\\CHF-working\\heartvoice-monitor\\.env.local',
        envVariable: 'WEBSOCKET_PUBLIC_URL',
        createLocalEnv: true,
        fallbackEnvFile: 'C:\\Users\\jeffr\\Downloads\\CHF-working\\heartvoice-monitor\\.env'
    }
];

async function getNgrokTunnels() {
    try {
        const response = await fetch(NGROK_API);
        if (!response.ok) {
            throw new Error(`Ngrok API returned ${response.status}`);
        }
        const data = await response.json();
        return data.tunnels;
    } catch (error) {
        throw new Error(`Failed to fetch ngrok tunnels: ${error.message}`);
    }
}

async function updateEnvFile(config, url) {
    try {
        let envContent = '';
        let envFilePath = config.envFile;

        // Check if we should create .env.local (for Next.js)
        if (config.createLocalEnv) {
            try {
                // Try to read existing .env.local
                envContent = await fs.readFile(envFilePath, 'utf8');
            } catch {
                // If .env.local doesn't exist, read from .env as template
                console.log(`  Creating ${envFilePath}`);
                try {
                    envContent = await fs.readFile(config.fallbackEnvFile, 'utf8');
                } catch {
                    envContent = '';
                }
            }
        } else {
            // Read existing env file
            envContent = await fs.readFile(envFilePath, 'utf8');
        }

        // Update or add the environment variable
        const envVarRegex = new RegExp(`^${config.envVariable}=.*`, 'm');
        if (envVarRegex.test(envContent)) {
            envContent = envContent.replace(envVarRegex, `${config.envVariable}=${url}`);
        } else {
            // Add the variable if it doesn't exist
            envContent += `\n${config.envVariable}=${url}\n`;
        }

        // Write updated content back
        await fs.writeFile(envFilePath, envContent, 'utf8');
        console.log(`  ✅ Updated ${config.envVariable} to: ${url}`);
    } catch (error) {
        throw new Error(`Failed to update ${config.envFile}: ${error.message}`);
    }
}

async function main() {
    console.log('🔄 Fetching current ngrok tunnels...\n');

    try {
        const tunnels = await getNgrokTunnels();

        if (tunnels.length === 0) {
            console.log('⚠️  No ngrok tunnels found. Is ngrok running?');
            console.log('   Start ngrok with: ngrok start --all --config=ngrok-config.yml');
            process.exit(1);
        }

        console.log('Found tunnels:');
        tunnels.forEach(tunnel => {
            const name = tunnel.name || 'unnamed';
            const proto = tunnel.proto;
            const url = tunnel.public_url;
            const addr = tunnel.config.addr;
            console.log(`  📡 ${name} (${proto}): ${url} -> ${addr}`);
        });
        console.log('');

        // Update each app's configuration
        let updatedCount = 0;
        for (const config of APP_CONFIGS) {
            console.log(`Processing ${config.name}...`);

            // Find the HTTPS tunnel for this app
            const appTunnel = tunnels.find(t =>
                t.proto === 'https' &&
                (t.name === config.tunnelName || t.config.addr.includes(config.port.toString()))
            );

            if (!appTunnel) {
                console.log(`  ⚠️  No HTTPS tunnel found for ${config.name} (${config.tunnelName}, port ${config.port})`);
                continue;
            }

            await updateEnvFile(config, appTunnel.public_url);
            updatedCount++;
        }

        console.log(`\n✅ Updated ${updatedCount} of ${APP_CONFIGS.length} apps successfully!`);

        console.log('\n📋 Next steps:');
        console.log('   1. Medical App: Restart Node.js server');
        console.log('      cd C:\\Users\\jeffr\\gpt40\\Basic-gpt40-agent');
        console.log('      npm run start:medical');
        console.log('');
        console.log('   2. HeartVoice Monitor: Restart Next.js dev server');
        console.log('      cd C:\\Users\\jeffr\\Downloads\\CHF-working\\heartvoice-monitor');
        console.log('      npm run dev:all');
        console.log('');
        console.log('   3. Verify webhook endpoints:');
        console.log('      - Medical: http://localhost:5051/api/webhook-info');
        console.log('      - HeartVoice: http://localhost:3004/api/webhook-info');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
