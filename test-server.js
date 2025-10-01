require('dotenv').config();
console.log('Environment loaded');

const fastify = require('fastify')({ logger: false });
console.log('Fastify loaded');

// Test minimal server
async function startTestServer() {
    try {
        console.log('Starting test server...');
        await fastify.listen({ port: 5051, host: '0.0.0.0' });
        console.log('Test server running on port 5051');
    } catch (err) {
        console.error('Test server error:', err);
        process.exit(1);
    }
}

startTestServer();