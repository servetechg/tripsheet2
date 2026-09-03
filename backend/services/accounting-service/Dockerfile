FROM node:20-alpine AS tenant-runtime-builder
WORKDIR /repo
COPY backend/shared/tenant-runtime/package*.json backend/shared/tenant-runtime/tsconfig.json ./backend/shared/tenant-runtime/
COPY backend/shared/tenant-runtime/src ./backend/shared/tenant-runtime/src/
RUN cd backend/shared/tenant-runtime && npm ci && npm run build

FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /repo/backend/services/accounting-service
COPY --from=tenant-runtime-builder /repo/backend/shared/tenant-runtime ../../shared/tenant-runtime
COPY backend/services/accounting-service/package*.json ./
COPY backend/services/accounting-service/prisma ./prisma/
RUN npm ci && npx prisma generate
COPY backend/services/accounting-service ./
RUN npm run build

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl wget
WORKDIR /repo/backend/services/accounting-service
ENV NODE_ENV=production
COPY --from=tenant-runtime-builder /repo/backend/shared/tenant-runtime ../../shared/tenant-runtime
COPY backend/services/accounting-service/package*.json ./
COPY backend/services/accounting-service/prisma ./prisma/
RUN npm ci --omit=dev \
  && npm install prisma@6.1.0 --no-save \
  && npx prisma generate
COPY --from=builder /repo/backend/services/accounting-service/dist ./dist
EXPOSE 3007
HEALTHCHECK --interval=15s --timeout=5s --start-period=25s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3007/health || exit 1
CMD ["node", "dist/main.js"]
