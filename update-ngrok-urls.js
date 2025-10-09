#!/usr/bin/env node

/**
 * Ngrok URL Updater
 * Automatically fetches current ngrok URLs and updates .env file
 */

import fetch from 'node-fetch';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NGROK_API = 'http://localhost:4040/api/tunnels';
const ENV_FILE = path.join(__dirname, '.env');

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

async function updateEnvFile(baseUrl) {
    try {
        // Read current .env file
        let envContent = await fs.readFile(ENV_FILE, 'utf8');

        // Update BASE_URL line
        const baseUrlRegex = /^BASE_URL=.*/m;
        if (baseUrlRegex.test(envContent)) {
            envContent = envContent.replace(baseUrlRegex, `BASE_URL=${baseUrl}`);
        } else {
            // Add BASE_URL if it doesn't exist
            envContent += `\nBASE_URL=${baseUrl}\n`;
        }

        // Write updated content back
        await fs.writeFile(ENV_FILE, envContent, 'utf8');
        console.log(`✅ Updated BASE_URL in .env to: ${baseUrl}`);
    } catch (error) {
        throw new Error(`Failed to update .env file: ${error.message}`);
    }
}

async function main() {
    console.log('🔄 Fetching current ngrok tunnels...\n');

    try {
        const tunnels = await getNgrokTunnels();

        if (tunnels.length === 0) {
            console.log('⚠️  No ngrok tunnels found. Is ngrok running?');
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

        // Find the HTTPS tunnel for the medical app (port 5051)
        const medicalTunnel = tunnels.find(t =>
            t.proto === 'https' &&
            (t.config.addr.includes('5051') || t.name === 'medical-app')
        );

        if (!medicalTunnel) {
            console.log('⚠️  No HTTPS tunnel found for port 5051');
            console.log('   Using first available HTTPS tunnel');
            const httpsTunnel = tunnels.find(t => t.proto === 'https');
            if (httpsTunnel) {
                await updateEnvFile(httpsTunnel.public_url);
            } else {
                console.log('❌ No HTTPS tunnels available');
                process.exit(1);
            }
        } else {
            await updateEnvFile(medicalTunnel.public_url);
        }

        console.log('\n✅ Configuration updated successfully!');
        console.log('\n📋 Next steps:');
        console.log('   1. Restart your Node.js server to pick up the new URL');
        console.log('   2. External agents can query: http://localhost:5051/api/webhook-info');
        console.log('   3. Webhook endpoint: ' + medicalTunnel.public_url + '/api/webhook/agent-trigger');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
