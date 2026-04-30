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

# Store templates outside /etc/nginx/templates/ to prevent the nginx image's
# built-in entrypoint from running envsubst on them (it would clobber nginx's
# own $variables like $host, $uri, $mealie). We run envsubst ourselves in
# docker-entrypoint.sh with an explicit variable allowlist instead.
COPY nginx.conf.template /etc/nginx/conf-templates/nginx.conf.template
COPY mealie-proxy-headers.conf.template /etc/nginx/conf-templates/mealie-proxy-headers.conf.template

# Entrypoint script: runs envsubst then starts nginx
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Copy only the static build output
COPY --from=build /app/dist/client /usr/share/nginx/html

EXPOSE 80

# Required runtime environment variables:
#   MEALIE_INTERNAL_URL  — internal Docker URL for Mealie, e.g.
#                          http://scottfamilynz-mealie-cvtizz-mealie-1:9000
#   MEALIE_API_TOKEN     — long-lived Mealie API token (never baked into JS)
ENTRYPOINT ["/docker-entrypoint.sh"]
