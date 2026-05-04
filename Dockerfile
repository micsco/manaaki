# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable pnpm && apk add --no-cache git

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

# Inject chunkIds + upload source maps to PostHog.
# - POSTHOG_PROJECT_ID is a non-secret build arg (Dokploy: Build Args).
# - POSTHOG_CLI_API_KEY comes via a BuildKit secret mount (Dokploy: Build Secrets),
#   so the value never lands in image layers or ENV. required=false lets local
#   `docker build` succeed without the secret — the step then no-ops.
ARG POSTHOG_PROJECT_ID
ARG POSTHOG_HOST=https://eu.posthog.com
RUN --mount=type=secret,id=POSTHOG_CLI_API_KEY,required=false \
    POSTHOG_CLI_API_KEY="$(cat /run/secrets/POSTHOG_CLI_API_KEY 2>/dev/null || true)"; \
    if [ -n "$POSTHOG_CLI_API_KEY" ] && [ -n "$POSTHOG_PROJECT_ID" ]; then \
      GIT_SHA=$(git rev-parse HEAD 2>/dev/null || echo unknown); \
      echo "Uploading source maps to PostHog (release: $GIT_SHA)"; \
      POSTHOG_CLI_TOKEN="$POSTHOG_CLI_API_KEY" \
      pnpm dlx @posthog/cli@latest --host "$POSTHOG_HOST" \
        sourcemap inject --directory dist/client && \
      POSTHOG_CLI_TOKEN="$POSTHOG_CLI_API_KEY" \
      pnpm dlx @posthog/cli@latest --host "$POSTHOG_HOST" \
        sourcemap upload --directory dist/client \
        --project-id "$POSTHOG_PROJECT_ID" \
        --release-name manaaki \
        --release-version "$GIT_SHA"; \
    else \
      echo "Skipping PostHog source map upload (POSTHOG_CLI_API_KEY/POSTHOG_PROJECT_ID not set)"; \
    fi

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
