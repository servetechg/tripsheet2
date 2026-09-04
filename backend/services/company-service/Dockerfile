FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /repo/backend/services/company-service
COPY backend/services/company-service/package*.json ./
COPY backend/services/company-service/prisma ./prisma/
RUN npm ci
RUN npx prisma generate
COPY backend/services/company-service ./
RUN npm run build

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl wget
WORKDIR /repo/backend/services/company-service
ENV NODE_ENV=production
COPY backend/services/company-service/package*.json ./
COPY backend/services/company-service/prisma ./prisma/
RUN npm ci --omit=dev \
  && npm install prisma@6.1.0 --no-save \
  && npx prisma generate
COPY --from=builder /repo/backend/services/company-service/dist ./dist
EXPOSE 3002
HEALTHCHECK --interval=15s --timeout=5s --start-period=25s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3002/health || exit 1
CMD ["node", "dist/main.js"]
