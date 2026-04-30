# syntax=docker/dockerfile:1

# ── Stage 1: Build ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable pnpm

# Install dependencies first (layer cache)
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Copy source and build.
# Note: VITE_MEALIE_API_TOKEN and VITE_MEALIE_BASE_URL are intentionally NOT
# passed here. The token is injected at runtime by nginx (see nginx.conf.template)
# so it never appears in the JS bundle.
COPY . .
RUN pnpm build

# ── Stage 2: Serve ──────────────────────────────────────────────────────────────
FROM nginx:stable-alpine AS serve

# Copy nginx config templates. These are processed at container start-up by
# envsubst, which substitutes MEALIE_INTERNAL_URL and MEALIE_API_TOKEN.
COPY nginx.conf.template /etc/nginx/templates/nginx.conf.template
COPY mealie-proxy-headers.conf.template /etc/nginx/templates/mealie-proxy-headers.conf.template

# Copy only the static build output
COPY --from=build /app/dist/client /usr/share/nginx/html

EXPOSE 80

# At start-up:
# 1. Substitute env vars into both templates and write to the nginx conf directory
# 2. Start nginx in the foreground
#
# Required runtime environment variables:
#   MEALIE_INTERNAL_URL  — internal Docker URL for Mealie, e.g.
#                          http://scottfamilynz-mealie-cvtizz-mealie-1:9000
#   MEALIE_API_TOKEN     — long-lived Mealie API token (never baked into JS)
CMD ["/bin/sh", "-c", \
  "envsubst '${MEALIE_INTERNAL_URL} ${MEALIE_API_TOKEN}' \
     < /etc/nginx/templates/nginx.conf.template \
     > /etc/nginx/conf.d/default.conf && \
   envsubst '${MEALIE_INTERNAL_URL} ${MEALIE_API_TOKEN}' \
     < /etc/nginx/templates/mealie-proxy-headers.conf.template \
     > /etc/nginx/conf.d/mealie-proxy-headers.conf && \
   nginx -g 'daemon off;'"]
