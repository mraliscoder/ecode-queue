const fs = require('fs');
const path = require('path');

// Simple health check script
function healthCheck() {
    try {
        // Check if queue directory exists
        const queueDir = process.env.QUEUE_DIR || '/app/image_queue';
        if (!fs.existsSync(queueDir)) {
            console.error('Queue directory does not exist');
            process.exit(1);
        }
        
        // Check if we can write to queue directory
        const testFile = path.join(queueDir, '.healthcheck');
        fs.writeFileSync(testFile, 'ok');
        fs.unlinkSync(testFile);
        
        // Check if logs directory exists
        const logsDir = '/app/logs';
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        
        console.log('Health check passed');
        process.exit(0);
        
    } catch (error) {
        console.error('Health check failed:', error);
        process.exit(1);
    }
}

healthCheck();