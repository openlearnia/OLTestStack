# OLTestStack MCP server — Bun runtime with Chromium for Puppeteer
FROM oven/bun:1.2-alpine

WORKDIR /app

# Chromium dependencies for Puppeteer on Alpine
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    MCP_TRANSPORT=http \
    MCP_HTTP_HOST=0.0.0.0 \
    MCP_HTTP_PORT=8082 \
    HEALTH_PORT=8081

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY tsconfig.json drizzle.config.ts ./
COPY drizzle ./drizzle
COPY src ./src

RUN bun run build

EXPOSE 8081 8082

CMD ["bun", "run", "start"]
