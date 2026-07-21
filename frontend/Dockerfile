# Docker file containerizing Vite React front-end application
FROM node:18-alpine

WORKDIR /app

# Copy dependency mappings
COPY package*.json ./

# Install packages
RUN npm install

# Copy source code
COPY . .

EXPOSE 5173

# Boot server
CMD ["npm", "run", "dev"]
