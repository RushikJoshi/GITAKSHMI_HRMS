const axios = require('axios');
const mongoose = require('mongoose');
const LetterTemplate = require('./models/LetterTemplate');
require('dotenv').config();

const API_URL = 'http://localhost:5174/api/letters/templates'; // Backend port from user screenshot is 5174? No, user screenshot shows frontend.
// Assuming backend is 5000 based on index.js, but let's check .env if possible.
// Wait, in index.js: const PORT = process.env.PORT || 5000;
// We should try 5000 first.

const runDebug = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ DB Connected');

        // 1. Find a Template to Delete (Create a dummy one first)
        const dummy = await LetterTemplate.create({
            name: 'DELETE_TEST_' + Date.now(),
            tenantId: 'tenant-123', // Assumption, but auth might fail if token needed.
            type: 'joining',
            filePath: 'dummy.docx'
        });
        console.log('Created Dummy Template:', dummy._id);

        // 2. Try to Delete it via API
        // We need a token if auth is enabled. The route uses `authenticate` and `requireHr`.
        // This makes testing via script hard without a valid token.
        // BUT, if it returns 404, it means route not found, NOT 401 Unauthorized.
        // So hitting it without token should give 401. If it gives 404, the path is wrong.

        try {
            console.log(`Attempting DELETE ${API_URL}/${dummy._id}`);
            // Use port 5000 directly to bypass frontend proxy
            await axios.delete(`https://hrms.gitakshmi.com/api/letters/templates/${dummy._id}`);
            console.log('✅ DELETE SUCCESS (200 OK)');
        } catch (e) {
            console.log('❌ API ERROR STATUS:', e.response?.status);
            console.log('❌ API ERROR DATA:', JSON.stringify(e.response?.data, null, 2));
            // Check if it's an express route error or our custom error
            if (e.response?.status === 404) {
                if (e.response?.data?.message === "Template not found") {
                    console.log('👉 CONCLUSION: CONTROLLER REACHED. ID/Tenant mismatch.');
                } else {
                    console.log('👉 CONCLUSION: ROUTE NOT FOUND (Express 404). Check index.js/routes.');
                }
            }
        }

        // Cleanup
        await LetterTemplate.findByIdAndDelete(dummy._id);
        console.log('Cleanup done');

    } catch (e) {
        console.error('DEBUG ERROR:', e);
    } finally {
        mongoose.connection.close();
    }
};

runDebug();
