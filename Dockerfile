# Self-hosted Supabase MCP Server
FROM node:lts-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source files
COPY . .

# Build the project
RUN npm run build

# Expose port for SSE mode
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/health || exit 1

# Run in SSE mode
ENTRYPOINT ["node", "dist/index.js", "--sse"]
