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

# Vite env vars must be present at build time
ARG VITE_MEALIE_BASE_URL
ARG VITE_MEALIE_API_TOKEN
ENV VITE_MEALIE_BASE_URL=$VITE_MEALIE_BASE_URL
ENV VITE_MEALIE_API_TOKEN=$VITE_MEALIE_API_TOKEN

# Copy source and build
COPY . .
RUN pnpm build

# ── Stage 2: Serve ──────────────────────────────────────────────────────────────
FROM nginx:stable-alpine AS serve

# Replace default nginx config with our SPA-friendly one
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy only the static build output
COPY --from=build /app/dist/client /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
