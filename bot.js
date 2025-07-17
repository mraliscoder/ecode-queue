const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Bot configuration
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const AUTHORIZED_USER_ID = process.env.AUTHORIZED_USER_ID;
const QUEUE_DIR = process.env.QUEUE_DIR || './image_queue';

// Create queue directory if it doesn't exist
if (!fs.existsSync(QUEUE_DIR)) {
    fs.mkdirSync(QUEUE_DIR, { recursive: true });
}

// Queue management
const QUEUE_FILE = path.join(QUEUE_DIR, 'queue.json');

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

function addToQueue(imageData) {
    const queue = loadQueue();
    queue.push({
        ...imageData,
        timestamp: new Date().toISOString(),
        id: Date.now().toString()
    });
    saveQueue(queue);
}

// Download image from Telegram
async function downloadImage(fileId, fileName) {
    try {
        const file = await bot.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
        
        const filePath = path.join(QUEUE_DIR, fileName);
        const fileStream = fs.createWriteStream(filePath);
        
        return new Promise((resolve, reject) => {
            https.get(fileUrl, (response) => {
                response.pipe(fileStream);
                fileStream.on('finish', () => {
                    fileStream.close();
                    resolve(filePath);
                });
                fileStream.on('error', reject);
            }).on('error', reject);
        });
    } catch (error) {
        console.error('Error downloading image:', error);
        throw error;
    }
}

// Handle photo messages
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    
    // Check if user is authorized
    if (userId !== AUTHORIZED_USER_ID) {
        await bot.sendMessage(chatId, 'You are not authorized to send images to this bot.');
        return;
    }
    
    try {
        // Get the highest resolution photo
        const photo = msg.photo[msg.photo.length - 1];
        const fileId = photo.file_id;
        
        // Generate UUID v4 filename with jpg extension
        const fileName = `${uuidv4()}.jpg`;
        
        // Download the image
        const filePath = await downloadImage(fileId, fileName);
        
        // Add to queue
        addToQueue({
            fileName: fileName,
            filePath: filePath,
            caption: msg.caption || '',
            messageId: msg.message_id,
            userId: userId
        });
        
        await bot.sendMessage(chatId, `✅ Image received and added to queue! File: ${fileName}`);
        console.log(`Image added to queue: ${fileName}`);
        
    } catch (error) {
        console.error('Error processing image:', error);
        await bot.sendMessage(chatId, '❌ Error processing image. Please try again.');
    }
});

// Handle text messages
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    
    // Skip if it's a photo message (already handled above)
    if (msg.photo) return;
    
    // Check if user is authorized
    if (userId !== AUTHORIZED_USER_ID) {
        await bot.sendMessage(chatId, 'You are not authorized to use this bot.');
        return;
    }
    
    const text = msg.text;
    
    if (text === '/start') {
        await bot.sendMessage(chatId, 'Welcome! Send me images and I\'ll add them to the queue for hourly posting.');
    } else if (text === '/status') {
        const queue = loadQueue();
        await bot.sendMessage(chatId, `Queue status: ${queue.length} images pending`);
    } else if (text === '/queue') {
        const queue = loadQueue();
        if (queue.length === 0) {
            await bot.sendMessage(chatId, 'Queue is empty.');
        } else {
            const queueList = queue.map((item, index) => 
                `${index + 1}. ${item.fileName} (${item.timestamp})`
            ).join('\n');
            await bot.sendMessage(chatId, `Queue (${queue.length} items):\n${queueList}`);
        }
    }
});

// Error handling
bot.on('error', (error) => {
    console.error('Bot error:', error);
});

bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

console.log('Bot started successfully!');
console.log(`Authorized user ID: ${AUTHORIZED_USER_ID}`);
console.log(`Queue directory: ${QUEUE_DIR}`);