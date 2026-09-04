FROM node:20-alpine AS tenant-runtime-builder
WORKDIR /repo
COPY backend/shared/tenant-runtime/package*.json backend/shared/tenant-runtime/tsconfig.json ./backend/shared/tenant-runtime/
COPY backend/shared/tenant-runtime/src ./backend/shared/tenant-runtime/src/
RUN cd backend/shared/tenant-runtime && npm ci && npm run build

FROM node:20-alpine AS builder
WORKDIR /repo/backend/gateway
COPY --from=tenant-runtime-builder /repo/backend/shared/tenant-runtime ../shared/tenant-runtime
COPY backend/gateway/package*.json ./
RUN npm ci
COPY backend/gateway ./
RUN npm run build

FROM node:20-alpine AS runner
RUN apk add --no-cache wget
WORKDIR /repo/backend/gateway
ENV NODE_ENV=production
COPY --from=tenant-runtime-builder /repo/backend/shared/tenant-runtime ../shared/tenant-runtime
COPY backend/gateway/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /repo/backend/gateway/dist ./dist
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "dist/main.js"]
