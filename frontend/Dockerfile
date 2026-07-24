# Build context: repository root
FROM node:20-alpine AS builder
WORKDIR /src

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

COPY shared ./shared
COPY frontend ./frontend

WORKDIR /src/shared
RUN npm ci && npm run build

WORKDIR /src/frontend
RUN npm ci && npm run build

FROM nginx:1.27-alpine AS runner
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /src/frontend/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1
CMD ["nginx", "-g", "daemon off;"]
