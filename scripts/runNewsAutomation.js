const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
require('dotenv').config();
const mongoose = require('mongoose');
const connectToMongoDB = require('../connect');
const { runNewsAutomation } = require('../services/newsAutomation');

async function main() {
    console.log('[Script] Connecting to MongoDB...');
    try {
        await connectToMongoDB(process.env.MONGODB_URL);
        console.log('[Script] MongoDB connected successfully.');

        // Extract CLI arguments if provided e.g. node runNewsAutomation.js --hours=4 --limit=5
        let hoursWindow = 4;
        let maxArticles = 5;

        process.argv.forEach(arg => {
            if (arg.startsWith('--hours=')) {
                hoursWindow = parseFloat(arg.split('=')[1]) || 4;
            }
            if (arg.startsWith('--limit=')) {
                maxArticles = parseInt(arg.split('=')[1]) || 5;
            }
        });

        await runNewsAutomation({ hoursWindow, maxArticles });
    } catch (err) {
        console.error('[Script] Execution error:', err);
    } finally {
        await mongoose.connection.close();
        console.log('[Script] Disconnected from MongoDB. Done.');
        process.exit(0);
    }
}

main();
