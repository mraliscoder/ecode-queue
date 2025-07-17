# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Install cron
RUN apk add --no-cache dcron

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create directories
RUN mkdir -p /app/image_queue /app/logs

# Create cron job file
RUN echo "0 * * * * cd /app && node scheduler.js >> /app/logs/scheduler.log 2>&1" > /etc/crontabs/root

# Make sure cron has proper permissions
RUN chmod 0644 /etc/crontabs/root

# Create startup script
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'echo "Starting cron daemon..."' >> /app/start.sh && \
    echo 'crond -l 2 -f &' >> /app/start.sh && \
    echo 'echo "Starting Telegram bot..."' >> /app/start.sh && \
    echo 'exec node bot.js' >> /app/start.sh && \
    chmod +x /app/start.sh

# Set environment variables
ENV NODE_ENV=production
ENV QUEUE_DIR=/app/image_queue

# Create volumes for persistent data
VOLUME ["/app/image_queue", "/app/logs"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node healthcheck.js || exit 1

# Start both cron and the bot
CMD ["/app/start.sh"]