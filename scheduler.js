const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Bot configuration
const bot = new TelegramBot(process.env.BOT_TOKEN);
const TARGET_CHANNEL = process.env.TARGET_CHANNEL; // e.g., '@yourchannel' or channel ID
const QUEUE_DIR = process.env.QUEUE_DIR || './image_queue';
const QUEUE_FILE = path.join(QUEUE_DIR, 'queue.json');

// Queue management
function loadQueue() {
    try {
        if (fs.existsSync(QUEUE_FILE)) {
            return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading queue:', error);
    }
    return [];
}

function saveQueue(queue) {
    try {
        fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
    } catch (error) {
        console.error('Error saving queue:', error);
    }
}

function removeFromQueue(itemId) {
    const queue = loadQueue();
    const updatedQueue = queue.filter(item => item.id !== itemId);
    saveQueue(updatedQueue);
    return updatedQueue;
}

// Process queue and send image
async function processQueue() {
    const queue = loadQueue();
    
    if (queue.length === 0) {
        console.log('Queue is empty, nothing to process.');
        return;
    }
    
    // Get the first item in queue (FIFO)
    const item = queue[0];
    
    try {
        console.log(`Processing image: ${item.fileName}`);
        
        // Check if file exists
        if (!fs.existsSync(item.filePath)) {
            console.error(`File not found: ${item.filePath}`);
            removeFromQueue(item.id);
            return;
        }
        
        // Send image to channel
        const options = {};
        if (item.caption) {
            options.caption = item.caption;
        }
        
        await bot.sendPhoto(TARGET_CHANNEL, item.filePath, options);
        
        console.log(`Successfully sent image ${item.fileName} to channel ${TARGET_CHANNEL}`);        
    } catch (error) {
        console.error(`Error sending image ${item.fileName}:`, error);
        
        // If it's a file not found error, remove from queue
        if (error.code === 'ENOENT') {
            console.log(`File not found, removing from queue: ${item.fileName}`);
            removeFromQueue(item.id);
        }
    } finally {
                // Remove from queue
        removeFromQueue(item.id);
        
        // Delete the file after successful upload
        try {
            fs.unlinkSync(item.filePath);
            console.log(`Deleted file: ${item.fileName}`);
        } catch (deleteError) {
            console.error(`Error deleting file ${item.fileName}:`, deleteError);
        }
    }
}

// Add logging with timestamp
function log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}

// Main execution
async function main() {
    try {
        log('Starting scheduler...');
        log(`Target channel: ${TARGET_CHANNEL}`);
        log(`Queue directory: ${QUEUE_DIR}`);
        
        await processQueue();
        
        log('Scheduler completed successfully');
        process.exit(0);
        
    } catch (error) {
        console.error('Scheduler error:', error);
        process.exit(1);
    }
}

// Run the scheduler
main();