# Use the official Playwright image with Chromium preinstalled
FROM mcr.microsoft.com/playwright:v1.45.0-jammy

# Set working directory
WORKDIR /app

# Copy files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your app
COPY . .

# Optional: Set environment
ENV NODE_ENV=production

# Start your app
CMD ["node", "server.js"]
