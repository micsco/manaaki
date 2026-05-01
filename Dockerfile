# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable pnpm

# Copy lockfile first so dependency layer is cached independently of source changes
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# PostHog vars are baked into the JS bundle at build time by Vite
ARG VITE_PUBLIC_POSTHOG_PROJECT_TOKEN
ARG VITE_PUBLIC_POSTHOG_HOST
ENV VITE_PUBLIC_POSTHOG_PROJECT_TOKEN=$VITE_PUBLIC_POSTHOG_PROJECT_TOKEN
ENV VITE_PUBLIC_POSTHOG_HOST=$VITE_PUBLIC_POSTHOG_HOST

COPY . .
RUN pnpm build

FROM nginx:stable-alpine AS serve

# Templates go in conf-templates/, not /etc/nginx/templates/, to prevent the
# nginx image's built-in entrypoint from running envsubst and clobbering nginx
# variables like $host and $uri. docker-entrypoint.sh handles substitution with
# an explicit variable allowlist.
COPY nginx.conf.template /etc/nginx/conf-templates/nginx.conf.template
COPY mealie-proxy-headers.conf.template /etc/nginx/conf-templates/mealie-proxy-headers.conf.template

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

COPY --from=build /app/dist/client /usr/share/nginx/html

EXPOSE 80

# Required: MEALIE_INTERNAL_URL, MEALIE_API_TOKEN
ENTRYPOINT ["/docker-entrypoint.sh"]
