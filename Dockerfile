FROM node:20-slim AS build
WORKDIR /app

COPY package.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app

ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev --legacy-peer-deps

COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/index.js"]
