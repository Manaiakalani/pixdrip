# syntax=docker/dockerfile:1.7

# Build stage
FROM node:22-alpine AS build
WORKDIR /app
ENV CI=1 \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false
COPY package.json package-lock.json ./
RUN npm ci --no-progress
COPY . .
RUN npx vite build

# Production stage
FROM nginx:1.27-alpine
LABEL org.opencontainers.image.title="pixdrip" \
      org.opencontainers.image.description="Blog image beautifier — borders, shadows, frames, platform sizing." \
      org.opencontainers.image.source="https://github.com/Manaiakalani/pixdrip" \
      org.opencontainers.image.licenses="MIT"

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q --spider http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
