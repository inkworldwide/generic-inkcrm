# Base Image
FROM node:20-alpine

# Working Directory
WORKDIR /app

# Package Files
COPY package*.json ./

# Install Dependencies
RUN npm ci

# Copy Source Code
COPY . .

# Build TypeScript
RUN npm run build

# Environment Variables Fallback
ENV PORT=5000
ENV NODE_ENV=production

# Expose API Port
EXPOSE 5000

# Start Application
CMD ["npm", "start"]
