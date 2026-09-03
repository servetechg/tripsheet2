FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++ openssl
WORKDIR /repo/backend/services/auth-service
COPY backend/services/auth-service/package*.json ./
COPY backend/services/auth-service/prisma ./prisma/
RUN npm ci
RUN npx prisma generate
COPY backend/services/auth-service ./
RUN npm run build

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl wget
WORKDIR /repo/backend/services/auth-service
ENV NODE_ENV=production
COPY backend/services/auth-service/package*.json ./
COPY backend/services/auth-service/prisma ./prisma/
RUN npm ci --omit=dev \
  && npm install prisma@6.1.0 --no-save \
  && npx prisma generate
COPY --from=builder /repo/backend/services/auth-service/dist ./dist
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --start-period=25s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3001/health || exit 1
CMD ["node", "dist/main.js"]
