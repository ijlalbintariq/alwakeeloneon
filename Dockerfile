FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-urd \
    poppler-utils \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN NODE_OPTIONS="--max-old-space-size=1536" npm run build

ENV NODE_ENV=production

CMD ["node", "dist/index.cjs"]
