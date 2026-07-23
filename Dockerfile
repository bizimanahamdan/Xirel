FROM node:20-slim AS build
WORKDIR /app

# better-sqlite3 needs build tools to compile its native addon
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

# Persistent data lives on a mounted volume at /data
ENV DATABASE_FILE=/data/store.db
ENV UPLOADS_DIR=/data/uploads
VOLUME ["/data"]

EXPOSE 3000
CMD ["node", "dist/index.js"]
