#!/bin/sh
set -eu

# envsubst is called with an explicit variable allowlist so that nginx variables
# like $host, $uri, and $mealie are left untouched in the output config.
envsubst '${MEALIE_INTERNAL_URL} ${MEALIE_API_TOKEN}' \
  < /etc/nginx/conf-templates/nginx.conf.template \
  > /etc/nginx/conf.d/default.conf

envsubst '${MEALIE_INTERNAL_URL} ${MEALIE_API_TOKEN}' \
  < /etc/nginx/conf-templates/mealie-proxy-headers.conf.template \
  > /etc/nginx/conf.d/mealie-proxy-headers.conf

node /app/dist/server/server.js &

exec nginx -g 'daemon off;'
