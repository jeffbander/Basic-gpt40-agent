import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env.production') });

const key = process.env.OPENAI_API_KEY;

if (!key) {
    console.log('❌ OPENAI_API_KEY is NOT set');
} else {
    console.log('✅ OPENAI_API_KEY is set');
    console.log(`   Length: ${key.length} characters`);
    console.log(`   Starts with: ${key.substring(0, 7)}...`);
    console.log(`   Ends with: ...${key.substring(key.length - 4)}`);

    // Test the key with a simple API call
    console.log('\nTesting API key with OpenAI...');
    fetch('https://api.openai.com/v1/models', {
        headers: {
            'Authorization': `Bearer ${key}`
        }
    })
    .then(res => {
        console.log(`Response status: ${res.status}`);
        if (res.ok) {
            console.log('✅ API key is VALID!');
        } else {
            console.log('❌ API key is INVALID!');
        }
        return res.json();
    })
    .then(data => {
        if (data.error) {
            console.log('Error:', data.error.message);
        }
    })
    .catch(err => {
        console.error('❌ Error testing API key:', err.message);
    });
}
