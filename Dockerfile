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

# Capture build/version metadata and bake it into the JS bundle via VITE_* vars,
# so the footer can show "deployed e6f6060 · 2026-05-04".
RUN GIT_SHA=$(git rev-parse HEAD 2>/dev/null || echo unknown) && \
    GIT_SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo unknown) && \
    BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ) && \
    VITE_BUILD_GIT_SHA="$GIT_SHA" \
    VITE_BUILD_GIT_SHORT_SHA="$GIT_SHORT_SHA" \
    VITE_BUILD_TIME="$BUILD_TIME" \
    pnpm build

# Inject chunkIds + upload source maps to PostHog.
# - POSTHOG_PROJECT_ID is a non-secret build arg (Dokploy: Build Args).
# - POSTHOG_CLI_API_KEY comes via a BuildKit secret mount (Dokploy: Build Secrets),
#   so the value never lands in image layers or ENV. required=false lets local
#   `docker build` succeed without the secret — the step then no-ops.
# The CLI reads credentials from POSTHOG_CLI_TOKEN/POSTHOG_CLI_PROJECT_ID/POSTHOG_CLI_HOST
# env vars; we export them so both `inject` and `upload` invocations inherit them
# (the CLI runs a credentials precheck before subcommand processing, so per-command
# `--project-id` flags don't satisfy it).
ARG POSTHOG_PROJECT_ID
ARG POSTHOG_HOST=https://eu.posthog.com
RUN --mount=type=secret,id=POSTHOG_CLI_API_KEY,required=false \
    if [ -s /run/secrets/POSTHOG_CLI_API_KEY ] && [ -n "$POSTHOG_PROJECT_ID" ]; then \
      export POSTHOG_CLI_TOKEN="$(cat /run/secrets/POSTHOG_CLI_API_KEY)"; \
      export POSTHOG_CLI_PROJECT_ID="$POSTHOG_PROJECT_ID"; \
      export POSTHOG_CLI_HOST="$POSTHOG_HOST"; \
      GIT_SHA=$(git rev-parse HEAD 2>/dev/null || echo unknown); \
      echo "Uploading source maps to PostHog (release: $GIT_SHA)"; \
      pnpm dlx @posthog/cli@latest sourcemap inject --directory dist/client && \
      pnpm dlx @posthog/cli@latest sourcemap upload --directory dist/client \
        --release-name manaaki \
        --release-version "$GIT_SHA"; \
    else \
      echo "Skipping PostHog source map upload (POSTHOG_CLI_API_KEY/POSTHOG_PROJECT_ID not set)"; \
    fi

RUN pnpm prune --prod

FROM nginx:stable-alpine AS serve

RUN apk add --no-cache nodejs

# Templates go in conf-templates/, not /etc/nginx/templates/, to prevent the
# nginx image's built-in entrypoint from running envsubst and clobbering nginx
# variables like $host and $uri. docker-entrypoint.sh handles substitution with
# an explicit variable allowlist.
COPY nginx.conf.template /etc/nginx/conf-templates/nginx.conf.template
COPY mealie-proxy-headers.conf.template /etc/nginx/conf-templates/mealie-proxy-headers.conf.template

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist
COPY --from=build /app/dist/client /app/html
COPY --from=build /app/server.js /app/server.js


EXPOSE 80

# Required: MEALIE_INTERNAL_URL, MEALIE_API_TOKEN
ENTRYPOINT ["/docker-entrypoint.sh"]
